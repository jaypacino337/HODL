//! Crowdy.fun — holder-gated, all-or-nothing crowdfunding.
//!
//! The shape of the thing:
//!
//!   Someone says "let's do this". Holders decide whether it happens by putting SOL
//!   behind it. If enough shows up before the deadline, the creator gets the money.
//!   If it doesn't, every backer takes their SOL back — in full, permissionlessly,
//!   without needing the creator's cooperation or anyone's permission.
//!
//! Three properties this program exists to guarantee:
//!
//!  1. **The creator cannot touch a lamport before the goal is met.** Contributions
//!     live in a vault PDA. `claim_funds` is gated on a campaign that has been
//!     finalized as Funded, and finalizing is only possible after the deadline.
//!     There is no code path from "campaign created" to "creator holds the money"
//!     that skips the goal.
//!
//!  2. **Refunds cannot be blocked.** `refund` needs only the backer's signature and
//!     a campaign in Failed state. Anyone can call `finalize` — it is permissionless
//!     on purpose, so a creator who walks away cannot strand backers in Active
//!     forever by simply never showing up.
//!
//!  3. **Only holders play.** Creating and backing both require a token account
//!     holding at least `gate_amount` of `gate_mint`. The check reads the live
//!     balance at the moment of the call, so selling out means losing eligibility.
//!
//! All amounts are lamports, u64, checked arithmetic. No floats anywhere.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("8xPvcUYHEiS4tq7NVuVTixfvXnMcLsaLQRLzVNk3eimU");

pub const PLATFORM_SEED: &[u8] = b"platform";
pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CONTRIBUTION_SEED: &[u8] = b"contribution";

pub const MAX_TITLE: usize = 64;
pub const MAX_SUMMARY: usize = 280;
pub const MAX_LINK: usize = 128;

/// Campaigns must run at least an hour and at most 30 days. A one-second campaign is
/// indistinguishable from a scam, and an open-ended one leaves backers' SOL locked
/// with no date on which they get it back.
pub const MIN_DURATION: i64 = 60 * 60;
pub const MAX_DURATION: i64 = 60 * 60 * 24 * 30;

/// Platform fee ceiling: 5%. Hardcoded so the authority cannot quietly raise it to
/// 100% and take a funded campaign's proceeds.
pub const MAX_FEE_BPS: u16 = 500;

#[program]
pub mod crowdy_campaign {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        gate_amount: u64,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, CrowdyError::FeeTooHigh);

        let p = &mut ctx.accounts.platform;
        p.bump = ctx.bumps.platform;
        p.authority = ctx.accounts.authority.key();
        p.gate_mint = ctx.accounts.gate_mint.key();
        p.gate_amount = gate_amount;
        p.fee_bps = fee_bps;
        p.fee_destination = ctx.accounts.fee_destination.key();
        p.campaign_count = 0;
        p.paused = false;

        emit!(PlatformInitialized {
            authority: p.authority,
            gate_mint: p.gate_mint,
            gate_amount,
            fee_bps,
        });
        Ok(())
    }

    /// Stops NEW campaigns and NEW contributions. Deliberately does not stop
    /// `finalize`, `claim_funds` or `refund` — pausing the platform must never trap
    /// money that is already in a vault.
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.platform.paused = paused;
        emit!(PausedChanged { paused });
        Ok(())
    }

    /// Change who is eligible. Applies to future calls only; campaigns already
    /// running are unaffected, and backers already in can always still refund.
    pub fn update_gate(ctx: Context<UpdateGate>, gate_amount: u64) -> Result<()> {
        let p = &mut ctx.accounts.platform;
        p.gate_mint = ctx.accounts.gate_mint.key();
        p.gate_amount = gate_amount;
        emit!(GateChanged {
            gate_mint: p.gate_mint,
            gate_amount
        });
        Ok(())
    }

    /// "Let's do this." Anyone holding enough of the gate token can post one.
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        params: CampaignParams,
    ) -> Result<()> {
        let platform = &ctx.accounts.platform;
        require!(!platform.paused, CrowdyError::PlatformPaused);

        require!(
            !params.title.trim().is_empty() && params.title.len() <= MAX_TITLE,
            CrowdyError::BadTitle
        );
        require!(params.summary.len() <= MAX_SUMMARY, CrowdyError::BadSummary);
        require!(params.link.len() <= MAX_LINK, CrowdyError::BadLink);
        require!(params.goal_lamports > 0, CrowdyError::GoalTooSmall);
        require!(
            params.duration >= MIN_DURATION && params.duration <= MAX_DURATION,
            CrowdyError::BadDuration
        );

        check_gate(
            &ctx.accounts.creator_gate_account,
            platform,
            &ctx.accounts.creator.key(),
        )?;

        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.campaign;
        c.bump = ctx.bumps.campaign;
        c.vault_bump = ctx.bumps.vault;
        c.id = platform.campaign_count;
        c.creator = ctx.accounts.creator.key();
        c.title = params.title;
        c.summary = params.summary;
        c.link = params.link;
        c.goal_lamports = params.goal_lamports;
        c.created_at = now;
        c.deadline = now
            .checked_add(params.duration)
            .ok_or(CrowdyError::MathOverflow)?;
        c.raised = 0;
        c.backer_count = 0;
        c.status = CampaignStatus::Active;

        let vault = &mut ctx.accounts.vault;
        vault.bump = ctx.bumps.vault;
        vault.campaign = c.key();

        let p = &mut ctx.accounts.platform;
        p.campaign_count = p
            .campaign_count
            .checked_add(1)
            .ok_or(CrowdyError::MathOverflow)?;

        emit!(CampaignCreated {
            id: c.id,
            creator: c.creator,
            goal_lamports: c.goal_lamports,
            deadline: c.deadline,
        });
        Ok(())
    }

    /// Back a campaign. Holder-gated, and only while it is genuinely live.
    ///
    /// Contributing twice accumulates into the same Contribution account rather than
    /// creating a second one, so a backer's refund is always one call for their whole
    /// position instead of one per contribution.
    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        let platform = &ctx.accounts.platform;
        require!(!platform.paused, CrowdyError::PlatformPaused);
        require!(amount > 0, CrowdyError::AmountZero);

        let now = Clock::get()?.unix_timestamp;
        {
            let c = &ctx.accounts.campaign;
            require!(c.status == CampaignStatus::Active, CrowdyError::NotActive);
            require!(now < c.deadline, CrowdyError::CampaignEnded);
        }

        check_gate(
            &ctx.accounts.backer_gate_account,
            platform,
            &ctx.accounts.backer.key(),
        )?;

        // SOL moves to the vault PDA. The creator has no authority over it.
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.backer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        let contribution = &mut ctx.accounts.contribution;
        let first_time = contribution.amount == 0;
        if first_time {
            contribution.bump = ctx.bumps.contribution;
            contribution.campaign = ctx.accounts.campaign.key();
            contribution.backer = ctx.accounts.backer.key();
            contribution.refunded = false;
        }
        require!(!contribution.refunded, CrowdyError::AlreadyRefunded);
        contribution.amount = contribution
            .amount
            .checked_add(amount)
            .ok_or(CrowdyError::MathOverflow)?;

        let c = &mut ctx.accounts.campaign;
        c.raised = c.raised.checked_add(amount).ok_or(CrowdyError::MathOverflow)?;
        if first_time {
            c.backer_count = c.backer_count.checked_add(1).ok_or(CrowdyError::MathOverflow)?;
        }

        emit!(Contributed {
            campaign: c.key(),
            backer: ctx.accounts.backer.key(),
            amount,
            total_raised: c.raised,
        });
        Ok(())
    }

    /// Settle a campaign after its deadline: Funded if it hit the goal, Failed if not.
    ///
    /// PERMISSIONLESS BY DESIGN. Anyone can call it, including a backer. A creator who
    /// vanishes after a failed campaign must not be able to strand everyone's SOL by
    /// simply never finalizing.
    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.campaign;

        require!(c.status == CampaignStatus::Active, CrowdyError::AlreadyFinalized);
        // Early finalize is allowed ONLY when the goal is already met — there is no
        // reason to make a funded campaign wait, and no way to abuse it.
        require!(
            now >= c.deadline || c.raised >= c.goal_lamports,
            CrowdyError::TooEarly
        );

        c.status = if c.raised >= c.goal_lamports {
            CampaignStatus::Funded
        } else {
            CampaignStatus::Failed
        };

        emit!(Finalized {
            campaign: c.key(),
            raised: c.raised,
            goal: c.goal_lamports,
            funded: c.status == CampaignStatus::Funded,
        });
        Ok(())
    }

    /// Creator withdraws a funded campaign's proceeds, minus the platform fee.
    pub fn claim_funds(ctx: Context<ClaimFunds>) -> Result<()> {
        let platform = &ctx.accounts.platform;
        let raised;
        {
            let c = &ctx.accounts.campaign;
            require!(c.status == CampaignStatus::Funded, CrowdyError::NotFunded);
            raised = c.raised;
        }

        // Integer basis-point maths. fee_bps is capped at MAX_FEE_BPS on write, and
        // re-checked here so a corrupted account cannot drain the payout.
        require!(platform.fee_bps <= MAX_FEE_BPS, CrowdyError::FeeTooHigh);
        let fee = (raised as u128)
            .checked_mul(platform.fee_bps as u128)
            .ok_or(CrowdyError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(CrowdyError::MathOverflow)? as u64;
        let payout = raised.checked_sub(fee).ok_or(CrowdyError::MathOverflow)?;

        if fee > 0 {
            move_lamports(
                &ctx.accounts.vault.to_account_info(),
                &ctx.accounts.fee_destination.to_account_info(),
                fee,
            )?;
        }
        move_lamports(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            payout,
        )?;

        let c = &mut ctx.accounts.campaign;
        c.status = CampaignStatus::Claimed;

        emit!(FundsClaimed {
            campaign: c.key(),
            creator: c.creator,
            payout,
            fee,
        });
        Ok(())
    }

    /// Take your SOL back from a failed campaign. Exact amount, no fee, no haircut.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        {
            let c = &ctx.accounts.campaign;
            require!(c.status == CampaignStatus::Failed, CrowdyError::NotRefundable);
        }

        let contribution = &mut ctx.accounts.contribution;
        require!(!contribution.refunded, CrowdyError::AlreadyRefunded);
        require!(contribution.amount > 0, CrowdyError::NothingToRefund);

        let amount = contribution.amount;
        // Mark refunded BEFORE moving lamports. Anchor's account model plus the
        // single-threaded runtime make re-entrancy impossible here, but ordering the
        // write first costs nothing and removes the question entirely.
        contribution.refunded = true;
        contribution.amount = 0;

        move_lamports(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.backer.to_account_info(),
            amount,
        )?;

        emit!(Refunded {
            campaign: ctx.accounts.campaign.key(),
            backer: ctx.accounts.backer.key(),
            amount,
        });
        Ok(())
    }

    /// A creator may pull their own campaign early, which sends it straight to Failed
    /// so every backer can refund immediately rather than waiting out the deadline.
    /// It can never move money to the creator.
    pub fn cancel_campaign(ctx: Context<CancelCampaign>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(c.status == CampaignStatus::Active, CrowdyError::AlreadyFinalized);
        c.status = CampaignStatus::Failed;

        emit!(Finalized {
            campaign: c.key(),
            raised: c.raised,
            goal: c.goal_lamports,
            funded: false,
        });
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Eligibility: hold at least `gate_amount` of `gate_mint`, right now.
fn check_gate(
    account: &InterfaceAccount<TokenAccount>,
    platform: &Platform,
    owner: &Pubkey,
) -> Result<()> {
    require!(account.owner == *owner, CrowdyError::NotYourTokenAccount);
    require!(account.mint == platform.gate_mint, CrowdyError::WrongGateMint);
    require!(
        account.amount >= platform.gate_amount,
        CrowdyError::NotAHolder
    );
    Ok(())
}

/// Move lamports out of a program-owned account.
///
/// The vault must stay rent-exempt or the runtime will reap it and strand whatever is
/// left, so the rent minimum is treated as untouchable. It is funded at creation and
/// is never part of anyone's contribution.
fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let rent_floor = Rent::get()?.minimum_balance(from.data_len());
    let available = from.lamports().saturating_sub(rent_floor);
    require!(available >= amount, CrowdyError::VaultInsufficient);

    **from.try_borrow_mut_lamports()? = from
        .lamports()
        .checked_sub(amount)
        .ok_or(CrowdyError::MathOverflow)?;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(CrowdyError::MathOverflow)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Platform {
    pub bump: u8,
    pub authority: Pubkey,
    /// The token you must hold to take part.
    pub gate_mint: Pubkey,
    /// Base units, not display units.
    pub gate_amount: u64,
    pub fee_bps: u16,
    pub fee_destination: Pubkey,
    pub campaign_count: u64,
    pub paused: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CampaignStatus {
    Active,
    Funded,
    Failed,
    Claimed,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub bump: u8,
    pub vault_bump: u8,
    pub id: u64,
    pub creator: Pubkey,
    #[max_len(MAX_TITLE)]
    pub title: String,
    #[max_len(MAX_SUMMARY)]
    pub summary: String,
    #[max_len(MAX_LINK)]
    pub link: String,
    pub goal_lamports: u64,
    pub raised: u64,
    pub backer_count: u32,
    pub created_at: i64,
    pub deadline: i64,
    pub status: CampaignStatus,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub bump: u8,
    pub campaign: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub bump: u8,
    pub campaign: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
    pub refunded: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CampaignParams {
    pub title: String,
    pub summary: String,
    pub link: String,
    pub goal_lamports: u64,
    pub duration: i64,
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Platform::INIT_SPACE,
        seeds = [PLATFORM_SEED],
        bump
    )]
    pub platform: Account<'info, Platform>,

    pub gate_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: destination for platform fees; any account may receive SOL.
    pub fee_destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(address = platform.authority @ CrowdyError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
}

#[derive(Accounts)]
pub struct UpdateGate<'info> {
    #[account(address = platform.authority @ CrowdyError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, Platform>,

    pub gate_mint: InterfaceAccount<'info, Mint>,
}

#[derive(Accounts)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, Platform>,

    #[account(
        init,
        payer = creator,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, &platform.campaign_count.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = creator,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    /// Proof of eligibility: the creator's own gate-token account.
    pub creator_gate_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub backer: Signer<'info>,

    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, Platform>,

    #[account(mut, seeds = [CAMPAIGN_SEED, &campaign.id.to_le_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, seeds = [VAULT_SEED, campaign.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    /// One per (campaign, backer). Contributing again tops up the same account.
    #[account(
        init_if_needed,
        payer = backer,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), backer.key().as_ref()],
        bump
    )]
    pub contribution: Account<'info, Contribution>,

    pub backer_gate_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    /// Anyone. Not the creator, not the authority — anyone.
    pub caller: Signer<'info>,

    #[account(mut, seeds = [CAMPAIGN_SEED, &campaign.id.to_le_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
pub struct ClaimFunds<'info> {
    #[account(mut, address = campaign.creator @ CrowdyError::Unauthorized)]
    pub creator: Signer<'info>,

    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, Platform>,

    #[account(mut, seeds = [CAMPAIGN_SEED, &campaign.id.to_le_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, seeds = [VAULT_SEED, campaign.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    /// CHECK: address-checked against the platform config.
    #[account(mut, address = platform.fee_destination @ CrowdyError::WrongFeeDestination)]
    pub fee_destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub backer: Signer<'info>,

    #[account(seeds = [CAMPAIGN_SEED, &campaign.id.to_le_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, seeds = [VAULT_SEED, campaign.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [CONTRIBUTION_SEED, campaign.key().as_ref(), backer.key().as_ref()],
        bump = contribution.bump,
        constraint = contribution.backer == backer.key() @ CrowdyError::Unauthorized
    )]
    pub contribution: Account<'info, Contribution>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelCampaign<'info> {
    #[account(address = campaign.creator @ CrowdyError::Unauthorized)]
    pub creator: Signer<'info>,

    #[account(mut, seeds = [CAMPAIGN_SEED, &campaign.id.to_le_bytes()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct PlatformInitialized {
    pub authority: Pubkey,
    pub gate_mint: Pubkey,
    pub gate_amount: u64,
    pub fee_bps: u16,
}

#[event]
pub struct PausedChanged {
    pub paused: bool,
}

#[event]
pub struct GateChanged {
    pub gate_mint: Pubkey,
    pub gate_amount: u64,
}

#[event]
pub struct CampaignCreated {
    pub id: u64,
    pub creator: Pubkey,
    pub goal_lamports: u64,
    pub deadline: i64,
}

#[event]
pub struct Contributed {
    pub campaign: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
    pub total_raised: u64,
}

#[event]
pub struct Finalized {
    pub campaign: Pubkey,
    pub raised: u64,
    pub goal: u64,
    pub funded: bool,
}

#[event]
pub struct FundsClaimed {
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub payout: u64,
    pub fee: u64,
}

#[event]
pub struct Refunded {
    pub campaign: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Errors — written to be shown to a user verbatim.
// ---------------------------------------------------------------------------

#[error_code]
pub enum CrowdyError {
    #[msg("Crowdy is paused. Existing campaigns still finalize and refund normally.")]
    PlatformPaused,
    #[msg("You need to hold more of the token to take part.")]
    NotAHolder,
    #[msg("That token account isn't yours.")]
    NotYourTokenAccount,
    #[msg("Wrong token — that isn't the one Crowdy gates on.")]
    WrongGateMint,
    #[msg("Only the campaign creator can do that.")]
    Unauthorized,
    #[msg("Give it a title.")]
    BadTitle,
    #[msg("That summary is too long.")]
    BadSummary,
    #[msg("That link is too long.")]
    BadLink,
    #[msg("The goal has to be more than zero.")]
    GoalTooSmall,
    #[msg("Campaigns run between 1 hour and 30 days.")]
    BadDuration,
    #[msg("Amount has to be more than zero.")]
    AmountZero,
    #[msg("This campaign isn't taking contributions.")]
    NotActive,
    #[msg("This campaign has ended.")]
    CampaignEnded,
    #[msg("Too early — this campaign is still running and hasn't hit its goal.")]
    TooEarly,
    #[msg("This campaign has already been settled.")]
    AlreadyFinalized,
    #[msg("This campaign wasn't funded, so there's nothing for the creator to claim.")]
    NotFunded,
    #[msg("Refunds are only open on campaigns that failed to hit their goal.")]
    NotRefundable,
    #[msg("You've already taken your refund.")]
    AlreadyRefunded,
    #[msg("You didn't back this campaign.")]
    NothingToRefund,
    #[msg("The vault doesn't hold enough to cover that.")]
    VaultInsufficient,
    #[msg("Platform fee cannot exceed 5%.")]
    FeeTooHigh,
    #[msg("Wrong fee destination.")]
    WrongFeeDestination,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
}
