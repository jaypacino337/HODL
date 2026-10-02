# Outlet

**One outlet, any appliance.**

Outlet is a concentrated-liquidity AMM where every pool can take one
appliance program that runs before and after swaps and liquidity changes,
inside limits fixed when the pool is created ("the wall rating"). A dynamic
fee, a TWAP oracle and range orders ship as appliances — anything else can
be written as a new appliance instead of a new AMM.

This repo is the site: a single-page Next.js app with

- an interactive outlet — drag an appliance in and the example pool re-wires
- a scroll-driven walkthrough of one swap (router → accounts → before →
  CLMM → after → settle), re-computed live per plugged appliance
- the wall-rating permission model and the day-one appliance catalog

No animation libraries — the scroll pipeline is `position: sticky` + rAF.

## Run

```bash
npm install
npm run dev     # :3000
```

## Deploy

Import the repo into Vercel — zero configuration needed.

> Concept build: the protocol on the page is a design, not a deployed
> program, and every number is a worked example.
