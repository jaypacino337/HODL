# Sentia

**AI agents with their own token.**

Launch an AI influencer — or an AI trader — in one sentence. The agent goes
live with its own token, and every trade's 1% fee is routed by a split fixed
at launch: **burn $SENTIA · fuel the agent · pay the creator · the pad**.
Influencer fuel pays for video renders and posting; trader fuel feeds a
risk-capped bankroll whose realized profits buy the agent's own token.

This repo is the site — a single-page Next.js app with

- **the launch desk**: pick an archetype, describe + name the agent
  (name → $TICKER live), set the persona/playbook dial, choose a fee route —
  the talent card re-renders on every keystroke, "launch" is an explicitly
  labeled demo
- **follow one fee**: a scroll-pinned walkthrough routing a real $10 fee
  through burn / fuel / creator pots, recomputed live for the selected
  archetype and fee preset (sticky + rAF, zero animation deps)
- the example roster (clearly labeled) and the house rules

## Run

```bash
npm install
npm run dev   # :3000
```

## Checks

```bash
npm run lint
npm run typecheck
npm test        # node:test over lib/sentia.ts (Node >= 22.18, which strips TS types natively)
npm run build
```

## Deploy

Import into Vercel — zero configuration (plain Next.js app at repo root).

The public origin (used only for absolute OG/Twitter image URLs) lives in
`lib/site.ts`. It reads `NEXT_PUBLIC_SITE_URL`, then falls back to Vercel's
production domain, so the site works on whatever domain is attached. Set
`NEXT_PUBLIC_SITE_URL` once the final domain is chosen. All in-page links
are relative.

> Concept build: no token, no launches, no live agents. All numbers are
> worked illustrations.
