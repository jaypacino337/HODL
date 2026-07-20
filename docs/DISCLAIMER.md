# Legal & risk disclaimer

This repository is a **technical reference implementation**, not a
launched product, financial offering, or investment vehicle. Before using
any part of it to launch a real token that the public can buy:

## Not affiliated with Robinhood

"Sherwood Protocol" and "$ARROW" deliberately do **not** use the name,
logo, ticker (`HOOD`), or branding of Robinhood Markets, Inc. Naming a
token after a real, regulated financial company would falsely imply a
partnership or endorsement that doesn't exist, and would likely infringe
Robinhood's trademarks. The "take from the trades, give to the holders"
theme is drawn from the public-domain Robin Hood folk tale, not the
brokerage.

## Not affiliated with pump.fun

This project integrates with pump.fun's public program and fee-sharing
system as a *user* of that platform, the same way any other token creator
would. It is not built, endorsed, or reviewed by pump.fun.

## Securities-law exposure

A token that is marketed with the promise of automatic, recurring payouts
to holders can look a lot like an investment contract to a regulator (the
Howey test, in the US, or equivalent tests elsewhere). Whether that's the
case depends heavily on how the project is marketed, who controls the fee
flow, and your jurisdiction. This repo does not constitute legal advice.
**Get independent legal review before publicly launching and marketing a
token with this mechanism**, especially before soliciting money from
people who aren't sophisticated crypto users.

## Rug-pull-shaped mechanics, used honestly or not

Fee-collecting tokens with an admin-controlled treasury wallet are a
common scam pattern: the "harvester" quietly routes fees to the founder
instead of holders, or the founder holds the fee/mint authority and drains
liquidity later. Nothing in this code prevents that — the fee authority,
LP vault, and rewards vault keypairs are simply wallets someone controls.
If you deploy this for real:

- Consider a multisig (e.g. Squads) for the fee authority and vaults
  instead of single-signer keypairs.
- Publish the vault addresses and make the harvest/distribution logic
  (this repo) publicly auditable, which is why it's structured as
  transparent, readable TypeScript rather than an opaque bot.
- Consider timelocking or renouncing the ability to change the LP/rewards
  split after launch, so it can't be quietly changed to 100% team.

## No warranty

This code is provided as-is, has not been professionally audited, moves
real funds if you point it at mainnet with a funded wallet, and interacts
with third-party programs (pump.fun, Raydium) whose interfaces can change
without notice. Test thoroughly on devnet first. You are responsible for
any funds you put behind it.
