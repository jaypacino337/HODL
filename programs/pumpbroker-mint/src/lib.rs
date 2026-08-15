//! PumpBrokers — PIECE 2: public mint.
//!
//! Design constraints this program exists to satisfy (see docs/LAUNCH_RUNBOOK.md):
//!
//!  * Launch day is ONE transaction: `set_active(true)`. Everything else — deploy,
//!    config, pool seeding, treasury creation — happens days earlier and is verified
//!    on devnet first. Nothing here requires a deploy or a migration at launch.
//!  * Assets are created inside the buyer's transaction and the BUYER pays the rent.
//!    Nothing is pre-minted. The project's per-mint cost is zero.
//!  * There is no sell-back logic in this program. Redemption is PIECE 3, a separate
//!    program with its own deployment. The only concession made here is a pair of
//!    authority-gated hooks (`return_to_pool`, `payout`) that are inert until
//!    `set_redeemer` is called — so PIECE 3 can be switched on later without ever
//!    redeploying or touching this program.
//!  * All token math is u64 base units. No floats anywhere.

use anchor_lang::prelude::*;
use solana_program::hash::hashv;
use solana_program::sysvar::slot_hashes;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use mpl_core::instructions::{CreateV2CpiBuilder, TransferV1CpiBuilder, UpdateV1CpiBuilder};
use mpl_core::types::DataState;

// Placeholder. Replaced by the real keypair's pubkey at first deploy —
// see docs/LAUNCH_RUNBOOK.md step 3.
declare_id!("8MziWLhyk1oWYM6di5eMsS9JAxXxfLgjXBKHb8NCSCKf");

pub const CONFIG_SEED: &[u8] = b"config";
pub const POOL_SEED: &[u8] = b"pool";
pub const ASSET_SEED: &[u8] = b"asset";
pub const VAULT_SEED: &[u8] = b"vault";

/// Hard ceiling on the collection. Enforced against the value passed to `initialize`
/// so a fat-fingered config can never create a 10,000-piece collection.
pub const MAX_TOTAL_SUPPLY: u16 = 1_000;

#[program]
pub mod pumpbroker_mint {
    use super::*;

    /// Step 1 of pre-launch setup. Creates the config PDA and the treasury token
    /// account. The mint starts PAUSED — `is_active` is false and cannot be set true
    /// in this instruction. That is deliberate.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        require!(params.price > 0, MintError::InvalidPrice);
        require!(
            params.total_supply > 0 && params.total_supply <= MAX_TOTAL_SUPPLY,
            MintError::InvalidSupply
        );
        require!(
            params.honorary_count < params.total_supply,
            MintError::InvalidSupply
        );
        require!(
            params.base_uri.len() <= MAX_URI_LEN && params.placeholder_uri.len() <= MAX_URI_LEN,
            MintError::UriTooLong
        );

        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.authority = ctx.accounts.authority.key();
        config.pending_authority = Pubkey::default();
        config.payment_mint = ctx.accounts.payment_mint.key();
        config.collection = ctx.accounts.collection.key();
        config.treasury = ctx.accounts.treasury.key();
        config.price = params.price;
        config.total_supply = params.total_supply;
        config.honorary_count = params.honorary_count;
        config.minted = 0;
        config.is_active = false;
        config.delayed_reveal = params.delayed_reveal;
        config.redeemer = Pubkey::default();
        config.base_uri = params.base_uri;
        config.placeholder_uri = params.placeholder_uri;

        let vault = &mut ctx.accounts.vault;
        vault.bump = ctx.bumps.vault;
        vault.queue = Vec::new();

        emit!(Initialized {
            authority: config.authority,
            payment_mint: config.payment_mint,
            collection: config.collection,
            price: config.price,
            total_supply: config.total_supply,
            honorary_count: config.honorary_count,
        });
        Ok(())
    }

    /// Step 2 of pre-launch setup. Seeds the unassigned-art pool with every index in
    /// `0..total_supply` EXCEPT the honorary indices, which were minted outside this
    /// program by PIECE 1 and already count against the 1,000 cap.
    ///
    /// Runs in a single transaction — 10 honorary indices is 20 bytes of instruction
    /// data, so there is no chunking to get wrong.
    pub fn init_pool(ctx: Context<InitPool>, honorary_indices: Vec<u16>) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.minted == 0, MintError::PoolAlreadyUsed);
        require!(
            honorary_indices.len() == config.honorary_count as usize,
            MintError::HonoraryCountMismatch
        );

        let pool = &mut ctx.accounts.pool;
        require!(pool.indices.is_empty(), MintError::PoolAlreadySeeded);
        pool.bump = ctx.bumps.pool;

        for (i, idx) in honorary_indices.iter().enumerate() {
            require!(*idx < config.total_supply, MintError::IndexOutOfRange);
            // Reject duplicates — a duplicate would silently leave a mintable index in
            // the pool that maps to art someone already owns.
            require!(
                !honorary_indices[..i].contains(idx),
                MintError::DuplicateHonoraryIndex
            );
        }

        for idx in 0..config.total_supply {
            if !honorary_indices.contains(&idx) {
                pool.indices.push(idx);
            }
        }
        pool.assigned = Vec::new();

        let expected = config.total_supply - config.honorary_count;
        require!(
            pool.indices.len() == expected as usize,
            MintError::PoolSeedMismatch
        );

        emit!(PoolSeeded {
            mintable: pool.indices.len() as u16
        });
        Ok(())
    }

    /// LAUNCH DAY. This is the whole launch: one instruction, ~5 seconds, one
    /// signature fee. Rehearsed on devnet, then on mainnet with `active = false`.
    /// Rollback is the same instruction with `active = false`.
    pub fn set_active(ctx: Context<AdminOnly>, active: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(!config.base_uri.is_empty(), MintError::NotConfigured);
        require!(
            ctx.accounts.pool.indices.len() + usize::from(config.minted) > 0,
            MintError::PoolNotSeeded
        );
        config.is_active = active;
        emit!(ActiveChanged { active });
        Ok(())
    }

    /// Public mint. Creates a fresh Core asset inside the buyer's transaction.
    ///
    /// `expected_number` is the buyer's view of the next mint number. If two wallets
    /// race for the same number, exactly one lands and the other gets
    /// `MintRaced` — a clean, retryable error rather than a confusing
    /// "account already in use" from the runtime. The client retries with the new
    /// number. This is the two-wallets-race-for-the-last-NFT case.
    pub fn mint(ctx: Context<MintBroker>, expected_number: u16) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.is_active, MintError::MintPaused);
        require!(
            config.minted == expected_number,
            MintError::MintRaced
        );

        let mintable = config
            .total_supply
            .checked_sub(config.honorary_count)
            .ok_or(MintError::MathOverflow)?;
        require!(config.minted < mintable, MintError::SoldOut);
        require!(!ctx.accounts.pool.indices.is_empty(), MintError::SoldOut);

        // ---- payment first, so a failed asset creation cannot leave tokens moved ----
        take_payment(
            &ctx.accounts.token_program,
            &ctx.accounts.minter_token_account,
            &ctx.accounts.treasury,
            &ctx.accounts.payment_mint,
            &ctx.accounts.minter,
            config.price,
        )?;

        // ---- draw the art index ----
        let art_index = {
            let pool = &mut ctx.accounts.pool;
            let entropy = slot_hash_entropy(&ctx.accounts.slot_hashes)?;
            let draw = hashv(&[
                &entropy,
                ctx.accounts.minter.key().as_ref(),
                &Clock::get()?.slot.to_le_bytes(),
                &config.minted.to_le_bytes(),
            ]);
            let n = u64::from_le_bytes(draw.to_bytes()[0..8].try_into().unwrap())
                % pool.indices.len() as u64;
            pool.indices.swap_remove(n as usize)
        };

        let mint_number = config.minted;
        let uri = if config.delayed_reveal {
            config.placeholder_uri.clone()
        } else {
            build_uri(&config.base_uri, art_index)
        };
        let name = format!("PumpBroker #{}", mint_number + 1);

        // ---- create the Core asset; the MINTER pays its rent ----
        let config_key = ctx.accounts.config.key();
        let number_bytes = mint_number.to_le_bytes();
        let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        let asset_seeds: &[&[u8]] = &[
            ASSET_SEED,
            config_key.as_ref(),
            &number_bytes,
            &[ctx.bumps.asset],
        ];

        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .authority(Some(&ctx.accounts.config.to_account_info()))
            .payer(&ctx.accounts.minter.to_account_info())
            .owner(Some(&ctx.accounts.minter.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .data_state(DataState::AccountState)
            .name(name)
            .uri(uri)
            .invoke_signed(&[config_seeds, asset_seeds])?;

        // ---- record the assignment on chain so the draw is auditable ----
        let pool = &mut ctx.accounts.pool;
        pool.assigned.push(art_index);

        let config = &mut ctx.accounts.config;
        config.minted = config
            .minted
            .checked_add(1)
            .ok_or(MintError::MathOverflow)?;

        emit!(Minted {
            mint_number,
            art_index,
            owner: ctx.accounts.minter.key(),
            revealed: !config.delayed_reveal,
        });
        Ok(())
    }

    /// Re-mint a broker that came back through PIECE 3. The asset already exists, so
    /// this transfers it out of the vault instead of creating it — which is why the
    /// hook has to exist in this program rather than in PIECE 3.
    ///
    /// Total supply stays at exactly 1,000: nothing is burned, nothing new is created.
    pub fn remint(ctx: Context<Remint>, expected_mint_number: u16) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.is_active, MintError::MintPaused);

        let vault = &ctx.accounts.vault;
        let head = *vault.queue.first().ok_or(MintError::VaultEmpty)?;
        require!(head == expected_mint_number, MintError::MintRaced);

        take_payment(
            &ctx.accounts.token_program,
            &ctx.accounts.minter_token_account,
            &ctx.accounts.treasury,
            &ctx.accounts.payment_mint,
            &ctx.accounts.minter,
            config.price,
        )?;

        let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.minter.to_account_info())
            .authority(Some(&ctx.accounts.vault.to_account_info()))
            .new_owner(&ctx.accounts.minter.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[
                config_seeds,
                &[VAULT_SEED, &[ctx.accounts.vault.bump]],
            ])?;

        ctx.accounts.vault.queue.remove(0);

        emit!(Reminted {
            mint_number: head,
            owner: ctx.accounts.minter.key(),
        });
        Ok(())
    }

    /// Delayed reveal. Publishes the real metadata URI for one asset after mint-out.
    ///
    /// Why this exists: any on-chain randomness we can access can be SIMULATED by a
    /// bot before it sends. With 100 airdrop-bearing pieces in the collection, a
    /// sniper would simulate, check whether it drew a `GMEx`, and drop the transaction
    /// if not — free re-rolls until it takes the valuable pieces. Nobody can
    /// pre-simulate a mapping that does not exist yet, so the URI stays a placeholder
    /// until the whole collection is drawn.
    pub fn reveal(ctx: Context<Reveal>, mint_number: u16, art_index: u16) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.delayed_reveal, MintError::RevealNotEnabled);
        require!(mint_number < config.minted, MintError::NotMinted);

        let recorded = *ctx
            .accounts
            .pool
            .assigned
            .get(mint_number as usize)
            .ok_or(MintError::NotMinted)?;
        // The reveal cannot rewrite history — it may only publish the index that was
        // drawn on chain at mint time.
        require!(recorded == art_index, MintError::RevealMismatch);

        let uri = build_uri(&config.base_uri, art_index);
        let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];

        UpdateV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.authority.to_account_info())
            .authority(Some(&ctx.accounts.config.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .new_uri(uri)
            .invoke_signed(&[config_seeds])?;

        emit!(Revealed {
            mint_number,
            art_index
        });
        Ok(())
    }

    // ---------------------------------------------------------------------------
    // PIECE 3 hooks. Inert until `set_redeemer` is called with a real address.
    // Nothing below implements buyback pricing, spreads, or redemption policy —
    // that all lives in the separate buyback program.
    // ---------------------------------------------------------------------------

    /// Point this program at the PIECE 3 buyback program's authority PDA. Until this
    /// is set, `return_to_pool` and `payout` cannot be called by anyone, including the
    /// authority. Setting it back to `None` kills PIECE 3's access instantly without
    /// touching the buyback program.
    pub fn set_redeemer(ctx: Context<AdminOnly>, redeemer: Option<Pubkey>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.redeemer = redeemer.unwrap_or_default();
        emit!(RedeemerChanged { redeemer });
        Ok(())
    }

    /// Accept a redeemed broker back into the vault, making it re-mintable.
    /// Signed by PIECE 3's PDA. The asset itself is transferred by PIECE 3 before it
    /// calls this — here we only record it.
    pub fn return_to_pool(ctx: Context<ReturnToPool>, mint_number: u16) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.redeemer != Pubkey::default(), MintError::RedeemerUnset);
        require!(mint_number < config.minted, MintError::NotMinted);

        let vault = &mut ctx.accounts.vault;
        require!(
            !vault.queue.contains(&mint_number),
            MintError::AlreadyInVault
        );
        require!(
            vault.queue.len() < MAX_TOTAL_SUPPLY as usize,
            MintError::VaultFull
        );
        vault.queue.push(mint_number);

        emit!(ReturnedToPool { mint_number });
        Ok(())
    }

    /// Move tokens out of the treasury to fund a redemption. Signed by PIECE 3's PDA.
    /// Reverts with a readable error if the treasury cannot cover the payout, which is
    /// the "vault can't cover it" path the buyback program surfaces to the user.
    pub fn payout(ctx: Context<Payout>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.redeemer != Pubkey::default(), MintError::RedeemerUnset);
        require!(amount > 0, MintError::InvalidAmount);
        require!(
            ctx.accounts.treasury.amount >= amount,
            MintError::TreasuryInsufficient
        );

        let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[config.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.treasury.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                &[config_seeds],
            ),
            amount,
            ctx.accounts.payment_mint.decimals,
        )?;

        emit!(PaidOut {
            amount,
            destination: ctx.accounts.destination.key()
        });
        Ok(())
    }

    // ---------------------------------------------------------------------------
    // Authority management — two-step, so a typo in a transfer cannot brick the mint.
    // ---------------------------------------------------------------------------

    pub fn transfer_authority(ctx: Context<AdminOnly>, new_authority: Pubkey) -> Result<()> {
        ctx.accounts.config.pending_authority = new_authority;
        Ok(())
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            config.pending_authority == ctx.accounts.new_authority.key(),
            MintError::NotPendingAuthority
        );
        config.authority = config.pending_authority;
        config.pending_authority = Pubkey::default();
        Ok(())
    }

    /// Owner withdrawal from the treasury. Separate from `payout` so that PIECE 3's
    /// access and the owner's access are independently revocable.
    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        require!(amount > 0, MintError::InvalidAmount);
        require!(
            ctx.accounts.treasury.amount >= amount,
            MintError::TreasuryInsufficient
        );

        let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.treasury.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                &[config_seeds],
            ),
            amount,
            ctx.accounts.payment_mint.decimals,
        )?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn take_payment<'info>(
    token_program: &Interface<'info, TokenInterface>,
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    authority: &Signer<'info>,
    price: u64,
) -> Result<()> {
    require!(from.amount >= price, MintError::InsufficientTokens);
    transfer_checked(
        CpiContext::new(
            token_program.key(),
            TransferChecked {
                from: from.to_account_info(),
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        price,
        mint.decimals,
    )
}

/// Reads the most recent entry from the SlotHashes sysvar without deserialising the
/// whole 20k account. Layout: 8-byte length prefix, then entries of
/// (u64 slot, 32-byte hash).
fn slot_hash_entropy(slot_hashes: &UncheckedAccount) -> Result<[u8; 32]> {
    let data = slot_hashes.try_borrow_data()?;
    require!(data.len() >= 8 + 8 + 32, MintError::BadSlotHashes);
    let mut out = [0u8; 32];
    out.copy_from_slice(&data[16..48]);
    Ok(out)
}

fn build_uri(base: &str, art_index: u16) -> String {
    // base is expected to end in '/', e.g. "https://arweave.net/<manifest>/"
    format!("{}{}.json", base, art_index)
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

pub const MAX_URI_LEN: usize = 200;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub bump: u8,
    pub authority: Pubkey,
    pub pending_authority: Pubkey,
    pub payment_mint: Pubkey,
    pub collection: Pubkey,
    pub treasury: Pubkey,
    /// Base units, not display units. 1,000,000 $PUMPBROKER at 6 decimals is
    /// 1_000_000_000_000 here.
    pub price: u64,
    pub total_supply: u16,
    pub honorary_count: u16,
    pub minted: u16,
    pub is_active: bool,
    pub delayed_reveal: bool,
    /// `Pubkey::default()` means unset — PIECE 3 is not wired up.
    pub redeemer: Pubkey,
    #[max_len(MAX_URI_LEN)]
    pub base_uri: String,
    #[max_len(MAX_URI_LEN)]
    pub placeholder_uri: String,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub bump: u8,
    /// Art indices not yet handed out, in arbitrary order (swap-remove draw).
    #[max_len(1000)]
    pub indices: Vec<u16>,
    /// `assigned[mint_number] == art_index`. Written at mint so the draw is auditable
    /// and the reveal cannot rewrite it.
    #[max_len(1000)]
    pub assigned: Vec<u16>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub bump: u8,
    /// Mint numbers of brokers that came back through PIECE 3, FIFO.
    #[max_len(1000)]
    pub queue: Vec<u16>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub price: u64,
    pub total_supply: u16,
    pub honorary_count: u16,
    pub delayed_reveal: bool,
    pub base_uri: String,
    pub placeholder_uri: String,
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, Vault>,

    pub payment_mint: InterfaceAccount<'info, Mint>,

    /// Treasury is owned by the config PDA — never a personal wallet.
    #[account(
        init,
        payer = authority,
        token::mint = payment_mint,
        token::authority = config,
        token::token_program = token_program,
        seeds = [b"treasury", config.key().as_ref()],
        bump
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: validated as the mpl-core collection at use sites; created off-program.
    pub collection: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitPool<'info> {
    #[account(mut, address = config.authority @ MintError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED],
        bump
    )]
    pub pool: Account<'info, Pool>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(address = config.authority @ MintError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
#[instruction(expected_number: u16)]
pub struct MintBroker<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(address = config.payment_mint @ MintError::WrongMint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = minter_token_account.mint == config.payment_mint @ MintError::WrongMint,
        constraint = minter_token_account.owner == minter.key() @ MintError::Unauthorized
    )]
    pub minter_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = config.treasury @ MintError::WrongTreasury)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: created by the mpl-core CPI at a PDA we derive here, so the address is
    /// fully constrained by seeds.
    #[account(
        mut,
        seeds = [ASSET_SEED, config.key().as_ref(), &expected_number.to_le_bytes()],
        bump
    )]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: address-checked against config.
    #[account(mut, address = config.collection @ MintError::WrongCollection)]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: address-checked against the mpl-core program id.
    #[account(address = mpl_core::ID @ MintError::WrongCoreProgram)]
    pub mpl_core_program: UncheckedAccount<'info>,

    /// CHECK: address-checked against the SlotHashes sysvar.
    #[account(address = slot_hashes::ID @ MintError::BadSlotHashes)]
    pub slot_hashes: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(expected_mint_number: u16)]
pub struct Remint<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(address = config.payment_mint @ MintError::WrongMint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = minter_token_account.mint == config.payment_mint @ MintError::WrongMint,
        constraint = minter_token_account.owner == minter.key() @ MintError::Unauthorized
    )]
    pub minter_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = config.treasury @ MintError::WrongTreasury)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: address constrained by seeds; ownership checked by mpl-core.
    #[account(
        mut,
        seeds = [ASSET_SEED, config.key().as_ref(), &expected_mint_number.to_le_bytes()],
        bump
    )]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: address-checked against config.
    #[account(mut, address = config.collection @ MintError::WrongCollection)]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: address-checked against the mpl-core program id.
    #[account(address = mpl_core::ID @ MintError::WrongCoreProgram)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mint_number: u16)]
pub struct Reveal<'info> {
    #[account(mut, address = config.authority @ MintError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    /// CHECK: address constrained by seeds.
    #[account(
        mut,
        seeds = [ASSET_SEED, config.key().as_ref(), &mint_number.to_le_bytes()],
        bump
    )]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: address-checked against config.
    #[account(mut, address = config.collection @ MintError::WrongCollection)]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: address-checked against the mpl-core program id.
    #[account(address = mpl_core::ID @ MintError::WrongCoreProgram)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReturnToPool<'info> {
    /// PIECE 3's PDA. Must equal `config.redeemer`, which starts unset.
    #[account(address = config.redeemer @ MintError::Unauthorized)]
    pub redeemer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct Payout<'info> {
    #[account(address = config.redeemer @ MintError::Unauthorized)]
    pub redeemer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(address = config.payment_mint @ MintError::WrongMint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, address = config.treasury @ MintError::WrongTreasury)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination.mint == config.payment_mint @ MintError::WrongMint
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(address = config.authority @ MintError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(address = config.payment_mint @ MintError::WrongMint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, address = config.treasury @ MintError::WrongTreasury)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination.mint == config.payment_mint @ MintError::WrongMint
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct Initialized {
    pub authority: Pubkey,
    pub payment_mint: Pubkey,
    pub collection: Pubkey,
    pub price: u64,
    pub total_supply: u16,
    pub honorary_count: u16,
}

#[event]
pub struct PoolSeeded {
    pub mintable: u16,
}

#[event]
pub struct ActiveChanged {
    pub active: bool,
}

#[event]
pub struct Minted {
    pub mint_number: u16,
    pub art_index: u16,
    pub owner: Pubkey,
    pub revealed: bool,
}

#[event]
pub struct Reminted {
    pub mint_number: u16,
    pub owner: Pubkey,
}

#[event]
pub struct Revealed {
    pub mint_number: u16,
    pub art_index: u16,
}

#[event]
pub struct RedeemerChanged {
    pub redeemer: Option<Pubkey>,
}

#[event]
pub struct ReturnedToPool {
    pub mint_number: u16,
}

#[event]
pub struct PaidOut {
    pub amount: u64,
    pub destination: Pubkey,
}

// ---------------------------------------------------------------------------
// Errors — every one of these is written to be shown to a user verbatim.
// ---------------------------------------------------------------------------

#[error_code]
pub enum MintError {
    #[msg("The mint is paused.")]
    MintPaused,
    #[msg("Someone else took that broker a moment before you. Try again — your next number is ready.")]
    MintRaced,
    #[msg("Sold out. All 1,000 brokers are claimed.")]
    SoldOut,
    #[msg("You don't have enough $PUMPBROKER for the mint price.")]
    InsufficientTokens,
    #[msg("Only the mint authority can do that.")]
    Unauthorized,
    #[msg("That is not the pending authority.")]
    NotPendingAuthority,
    #[msg("Price must be greater than zero.")]
    InvalidPrice,
    #[msg("Supply must be between 1 and 1,000, and honorary count must be lower than it.")]
    InvalidSupply,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Metadata URI is too long.")]
    UriTooLong,
    #[msg("The mint has not been configured yet.")]
    NotConfigured,
    #[msg("The art pool has not been seeded yet.")]
    PoolNotSeeded,
    #[msg("The art pool has already been seeded.")]
    PoolAlreadySeeded,
    #[msg("The pool cannot be re-seeded after minting has started.")]
    PoolAlreadyUsed,
    #[msg("Honorary index list does not match the configured honorary count.")]
    HonoraryCountMismatch,
    #[msg("Duplicate honorary index.")]
    DuplicateHonoraryIndex,
    #[msg("Art index is outside the collection.")]
    IndexOutOfRange,
    #[msg("Seeded pool size does not match total supply minus honoraries.")]
    PoolSeedMismatch,
    #[msg("Wrong token mint for this collection.")]
    WrongMint,
    #[msg("Wrong treasury account.")]
    WrongTreasury,
    #[msg("Wrong collection account.")]
    WrongCollection,
    #[msg("Wrong Metaplex Core program.")]
    WrongCoreProgram,
    #[msg("Could not read the SlotHashes sysvar.")]
    BadSlotHashes,
    #[msg("Delayed reveal is not enabled for this collection.")]
    RevealNotEnabled,
    #[msg("That broker has not been minted.")]
    NotMinted,
    #[msg("Reveal does not match the art index drawn on chain at mint time.")]
    RevealMismatch,
    #[msg("The buyback program is not connected. Redemption is off.")]
    RedeemerUnset,
    #[msg("There are no brokers in the vault to re-mint.")]
    VaultEmpty,
    #[msg("That broker is already in the vault.")]
    AlreadyInVault,
    #[msg("The vault is full.")]
    VaultFull,
    #[msg("The treasury cannot cover this payout right now.")]
    TreasuryInsufficient,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
}
