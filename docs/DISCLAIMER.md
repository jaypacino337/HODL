# Read before going live

This repo is provided as a working reference implementation. Deploying it
for real people and real money is **your** decision and responsibility.
Non-exhaustive things to think about first:

## It is a game of chance

Players stake nothing directly, but they receive randomized SOL payouts
gated by holding a speculative asset. In many jurisdictions that can fall
under gambling, sweepstakes, or lottery rules — and "the pot came from
trading fees" is not automatically a defense. The 1M-token gate makes
eligibility *purchasable*, which regulators may read as consideration.
Get actual legal advice for the jurisdictions you expect players from,
and geo-block where you have to.

## It may look like a security

Marketing "hold our token, receive recurring SOL payouts funded by the
project's revenue" is uncomfortably close to the language securities
regulators quote back at token projects. How you market this matters as
much as how it works. Again: real legal advice, not a README.

## Custody and key risk

The creator wallet is the vault. Whoever holds that keypair can drain the
pot. It sits as an env var on Railway — anyone with access to your Railway
project effectively holds the bankroll. Creator fees cannot be re-keyed to
a different wallet, so protect this one: minimal collaborator access, no
keypair in git, consider sweeping excess balance to cold storage between
rounds.

## Randomness caveat

The blockhash flip is fair *between players* (picks lock before the hash
exists) but the operator could in principle delay settlement to re-roll.
Publishing the blockhash and settle times (this implementation does both)
makes that detectable, not impossible. If the pots get serious, upgrade
`decideWinningSide()` to a VRF (e.g. Switchboard).

## Fee-stream dependency

pump.fun's creator-fee program is theirs to change. Claim instructions have
already migrated once (`collect_creator_fee` → `v2`). Pin the SDK versions,
watch their release notes, and expect to maintain the harvester.

## Operational honesty

The site shows lifetime fees claimed vs. paid out, and every claim/payout
tx signature is recorded. Keep it that way — quietly skimming the vault
while advertising "fees fund the game" is fraud in most places, no matter
how the token is classified.
