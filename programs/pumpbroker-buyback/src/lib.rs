//! PumpBrokers — PIECE 3: buyback.
//!
//! A separate Anchor program with its own program id and its own deployment. It is
//! built and deployed AFTER launch, and switching it on does not require touching or
//! redeploying PIECE 2 — the mint program ships with two inert, authority-gated hooks
//! (`return_to_pool`, `payout`) that stay dead until the owner calls
//! `set_redeemer(Some(<this program's config PDA>))`.
//!
//! Economics: a holder sends a broker in and receives `payout_amount` back. The mint
//! charges `price`. The spread between them (50,000 $PUMPBROKER per round trip at the
//! configured numbers) is the point of the mechanism and stays in the treasury.
//!
//! Killing this program is one `set_redeemer(None)` on PIECE 2 — instant, and it
//! cannot take the mint down with it.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use mpl_core::instructions::TransferV1CpiBuilder;
use pumpbroker_mint::program::PumpbrokerMint;
use pumpbroker_mint::{Config as MintConfig, Vault as MintVault};

// Placeholder. Replaced by the real keypair's pubkey at first deploy.
declare_id!("98ECcFgwqei1mMnhvBjCxmqdZtA6GxVPF3iSKjWvwF4d");

pub const BUYBACK_CONFIG_SEED: &[u8] = b"buyback";

#[program]
pub mod pumpbroker_buyback {
    use super::*;

    /// Deploy-time setup. Starts PAUSED, exactly like the mint.
    ///
    /// `payout_amount` is in base units. At 6 decimals, 950,000 $PUMPBROKER is
    /// 950_000_000_000. It is validated against the mint's price so a
    /// mis-typed config cannot create a payout that exceeds what a mint brings in —
    /// that would be a money pump pointed at your own treasury.
    pub fn initialize(ctx: Context<Initialize>, payout_amount: u64) -> Result<()> {
        require!(payout_amount > 0, BuybackError::InvalidAmount);
        require!(
            payout_amount < ctx.accounts.mint_config.price,
            BuybackError::PayoutExceedsMintPrice
        );

        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.authority = ctx.accounts.authority.key();
        config.pending_authority = Pubkey::default();
        config.mint_config = ctx.accounts.mint_config.key();
        config.payment_mint = ctx.accounts.mint_config.payment_mint;
        config.collection = ctx.accounts.mint_config.collection;
        config.payout_amount = payout_amount;
        config.is_active = false;
        config.redeemed = 0;

        emit!(BuybackInitialized {
            authority: config.authority,
            payout_amount,
            spread: ctx.accounts.mint_config.price - payout_amount,
        });
        Ok(())
    }

    /// Opens redemption. Separate from PIECE 2's `set_active` — the mint and the
    /// buyback are independently killable, which is the whole reason they are two
    /// programs.
    ///
    /// Note this is only half the switch: PIECE 2's `set_redeemer` must also point at
    /// this program's config PDA. Either one being off means no redemptions.
    pub fn set_active(ctx: Context<AdminOnly>, active: bool) -> Result<()> {
        ctx.accounts.config.is_active = active;
        emit!(BuybackActiveChanged { active });
        Ok(())
    }

    pub fn set_payout_amount(ctx: Context<SetPayoutAmount>, payout_amount: u64) -> Result<()> {
        require!(payout_amount > 0, BuybackError::InvalidAmount);
        require!(
            payout_amount < ctx.accounts.mint_config.price,
            BuybackError::PayoutExceedsMintPrice
        );
        ctx.accounts.config.payout_amount = payout_amount;
        Ok(())
    }

    /// Send a broker in, get `payout_amount` back.
    ///
    /// Three CPIs, all in one transaction, so there is no state where the user has
    /// given up the asset without being paid:
    ///   1. mpl-core `TransferV1`  — asset moves from the holder to PIECE 2's vault.
    ///   2. PIECE 2 `return_to_pool` — vault records it as re-mintable.
    ///   3. PIECE 2 `payout`        — treasury pays the holder.
    ///
    /// Supply stays at exactly 1,000 throughout: nothing is burned and nothing new is
    /// created. The broker sits in the vault until someone re-mints it.
    ///
    /// The vault-can't-cover-it case is checked here for a readable error AND enforced
    /// again inside PIECE 2's `payout`. The second check is the real one — two
    /// redemptions racing for the last of the treasury both pass this pre-check, and
    /// the loser is rejected atomically by the on-chain balance check in step 3.
    pub fn redeem(ctx: Context<Redeem>, mint_number: u16) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.is_active, BuybackError::BuybackPaused);
        require!(
            ctx.accounts.mint_config.redeemer == config.key(),
            BuybackError::NotConnected
        );
        require!(
            ctx.accounts.treasury.amount >= config.payout_amount,
            BuybackError::VaultInsufficient
        );

        let signer_seeds: &[&[u8]] = &[BUYBACK_CONFIG_SEED, &[config.bump]];

        // 1. asset -> PIECE 2's vault. The holder signs this; we never take custody.
        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.holder.to_account_info())
            .authority(Some(&ctx.accounts.holder.to_account_info()))
            .new_owner(&ctx.accounts.mint_vault.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke()?;

        // 2. record it as re-mintable in PIECE 2.
        pumpbroker_mint::cpi::return_to_pool(
            CpiContext::new_with_signer(
                ctx.accounts.mint_program.key(),
                pumpbroker_mint::cpi::accounts::ReturnToPool {
                    redeemer: ctx.accounts.config.to_account_info(),
                    config: ctx.accounts.mint_config.to_account_info(),
                    vault: ctx.accounts.mint_vault.to_account_info(),
                },
                &[signer_seeds],
            ),
            mint_number,
        )?;

        // 3. pay the holder out of PIECE 2's treasury.
        pumpbroker_mint::cpi::payout(
            CpiContext::new_with_signer(
                ctx.accounts.mint_program.key(),
                pumpbroker_mint::cpi::accounts::Payout {
                    redeemer: ctx.accounts.config.to_account_info(),
                    config: ctx.accounts.mint_config.to_account_info(),
                    payment_mint: ctx.accounts.payment_mint.to_account_info(),
                    treasury: ctx.accounts.treasury.to_account_info(),
                    destination: ctx.accounts.holder_token_account.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                &[signer_seeds],
            ),
            config.payout_amount,
        )?;

        let config = &mut ctx.accounts.config;
        config.redeemed = config
            .redeemed
            .checked_add(1)
            .ok_or(BuybackError::MathOverflow)?;

        emit!(Redeemed {
            mint_number,
            holder: ctx.accounts.holder.key(),
            payout: config.payout_amount,
        });
        Ok(())
    }

    pub fn transfer_authority(ctx: Context<AdminOnly>, new_authority: Pubkey) -> Result<()> {
        ctx.accounts.config.pending_authority = new_authority;
        Ok(())
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            config.pending_authority == ctx.accounts.new_authority.key(),
            BuybackError::NotPendingAuthority
        );
        config.authority = config.pending_authority;
        config.pending_authority = Pubkey::default();
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct BuybackConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub pending_authority: Pubkey,
    pub mint_config: Pubkey,
    pub payment_mint: Pubkey,
    pub collection: Pubkey,
    /// Base units. 950,000 $PUMPBROKER at 6 decimals is 950_000_000_000.
    pub payout_amount: u64,
    pub is_active: bool,
    pub redeemed: u32,
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
        space = 8 + BuybackConfig::INIT_SPACE,
        seeds = [BUYBACK_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, BuybackConfig>,

    /// PIECE 2's config, read-only. We copy the mint, collection and price from it so
    /// the two programs cannot drift apart in config.
    #[account(
        constraint = mint_config.authority == authority.key() @ BuybackError::Unauthorized
    )]
    pub mint_config: Account<'info, MintConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(address = config.authority @ BuybackError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [BUYBACK_CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, BuybackConfig>,
}

#[derive(Accounts)]
pub struct SetPayoutAmount<'info> {
    #[account(address = config.authority @ BuybackError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [BUYBACK_CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, BuybackConfig>,

    #[account(address = config.mint_config @ BuybackError::WrongMintConfig)]
    pub mint_config: Account<'info, MintConfig>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(mut, seeds = [BUYBACK_CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, BuybackConfig>,
}

#[derive(Accounts)]
#[instruction(mint_number: u16)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(mut, seeds = [BUYBACK_CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, BuybackConfig>,

    #[account(mut, address = config.mint_config @ BuybackError::WrongMintConfig)]
    pub mint_config: Account<'info, MintConfig>,

    #[account(
        mut,
        seeds = [pumpbroker_mint::VAULT_SEED],
        bump = mint_vault.bump,
        seeds::program = mint_program.key()
    )]
    pub mint_vault: Account<'info, MintVault>,

    /// CHECK: address is fully constrained by PIECE 2's asset seeds, so a caller
    /// cannot substitute an asset from another collection or another mint number.
    #[account(
        mut,
        seeds = [
            pumpbroker_mint::ASSET_SEED,
            mint_config.key().as_ref(),
            &mint_number.to_le_bytes()
        ],
        bump,
        seeds::program = mint_program.key()
    )]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: address-checked against the mint config.
    #[account(mut, address = config.collection @ BuybackError::WrongCollection)]
    pub collection: UncheckedAccount<'info>,

    #[account(address = config.payment_mint @ BuybackError::WrongMint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, address = mint_config.treasury @ BuybackError::WrongTreasury)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = holder_token_account.mint == config.payment_mint @ BuybackError::WrongMint,
        constraint = holder_token_account.owner == holder.key() @ BuybackError::Unauthorized
    )]
    pub holder_token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint_program: Program<'info, PumpbrokerMint>,

    /// CHECK: address-checked against the mpl-core program id.
    #[account(address = mpl_core::ID @ BuybackError::WrongCoreProgram)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct BuybackInitialized {
    pub authority: Pubkey,
    pub payout_amount: u64,
    pub spread: u64,
}

#[event]
pub struct BuybackActiveChanged {
    pub active: bool,
}

#[event]
pub struct Redeemed {
    pub mint_number: u16,
    pub holder: Pubkey,
    pub payout: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum BuybackError {
    #[msg("Sell-back is paused right now.")]
    BuybackPaused,
    #[msg("The treasury can't cover a buyback right now. Check back after more brokers are minted.")]
    VaultInsufficient,
    #[msg("The mint program has not connected this buyback program yet.")]
    NotConnected,
    #[msg("Payout must be less than the mint price — otherwise the treasury drains on every round trip.")]
    PayoutExceedsMintPrice,
    #[msg("Only the buyback authority can do that.")]
    Unauthorized,
    #[msg("That is not the pending authority.")]
    NotPendingAuthority,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Wrong mint config account.")]
    WrongMintConfig,
    #[msg("Wrong token mint.")]
    WrongMint,
    #[msg("Wrong treasury account.")]
    WrongTreasury,
    #[msg("Wrong collection account.")]
    WrongCollection,
    #[msg("Wrong Metaplex Core program.")]
    WrongCoreProgram,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
}
