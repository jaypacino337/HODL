/**
 * The appliance catalog and the per-appliance swap scenario that drives both
 * the hero widget and the scroll-driven swap walkthrough. One source of
 * truth so the two stay in sync.
 */

export type PlugId = "empty" | "dynamic-fee" | "twap" | "range" | "custom";

export interface Plug {
  id: PlugId;
  name: string;
  short: string;
  color: string; // tailwind color token value
  blurb: string;
  phases: Array<"before swap" | "after swap" | "before add" | "after add" | "before remove" | "after remove">;
  permissions: string[];
}

export const PLUGS: Plug[] = [
  {
    id: "dynamic-fee",
    name: "Dynamic fee",
    short: "fee",
    color: "#3056D6",
    blurb: "Reprices the swap fee from recent volatility, inside the cap the pool fixed at creation.",
    phases: ["before swap"],
    permissions: ["fee override ≤ 1.00%"],
  },
  {
    id: "twap",
    name: "TWAP oracle",
    short: "oracle",
    color: "#0D9488",
    blurb: "Writes a time-weighted price observation after every swap. Other programs read it for free.",
    phases: ["after swap"],
    permissions: ["writes own account only"],
  },
  {
    id: "range",
    name: "Range order",
    short: "orders",
    color: "#C2366F",
    blurb: "Turns crossed ticks into fills: limit orders made of liquidity, settled when price passes through.",
    phases: ["after swap", "after add", "after remove"],
    permissions: ["no fee override", "input surcharge ≤ 0.05%"],
  },
  {
    id: "custom",
    name: "Your appliance",
    short: "yours",
    color: "#B45309",
    blurb: "Any program that respects the wall rating. Ship an idea as an appliance, not a new AMM.",
    phases: ["before swap", "after swap", "before add", "after add", "before remove", "after remove"],
    permissions: ["whatever the pool rated at creation"],
  },
];

export const PLUG_BY_ID = Object.fromEntries(PLUGS.map((p) => [p.id, p])) as Record<string, Plug>;

/** The example swap: 40 SOL → USD in the SOL/USD example pool. */
export interface SwapScenario {
  feeLabel: string;
  feeNote: string;
  beforeTitle: string;
  beforeBody: string;
  clmmBody: string;
  afterTitle: string;
  afterBody: string;
  priceFrom: number;
  priceTo: number;
  out: number;
  accounts: number;
  settleNote: string;
}

export const SCENARIOS: Record<PlugId, SwapScenario> = {
  empty: {
    feeLabel: "0.30%",
    feeNote: "pool fee · no appliance",
    beforeTitle: "Nothing before the swap",
    beforeBody: "Empty outlet: no appliance, no call. The pool runs like a plain CLMM.",
    clmmBody: "40 SOL in at a 0.30% fee moves the price from 148.20 to 147.61 through the pool's concentrated liquidity. No appliance runs inside this step.",
    afterTitle: "Nothing after the swap",
    afterBody: "Empty outlet: no appliance, no call.",
    priceFrom: 148.2,
    priceTo: 147.61,
    out: 5898.43,
    accounts: 10,
    settleNote: "5,898.43 USD out. If any appliance call had failed, the whole swap would revert and the router could take another path.",
  },
  "dynamic-fee": {
    feeLabel: "0.42%",
    feeNote: "appliance override · cap 1.00%",
    beforeTitle: "The fee gets repriced",
    beforeBody: "The dynamic-fee appliance reads recent volatility and overrides this swap's fee to 0.42% — under the 1.00% cap the pool rated at creation.",
    clmmBody: "40 SOL in at the overridden 0.42% fee moves the price from 148.20 to 147.62. The CLMM math itself is untouched — only the fee input changed.",
    afterTitle: "Nothing after the swap",
    afterBody: "The dynamic fee only holds a before-swap permission. After-swap is a no-op.",
    priceFrom: 148.2,
    priceTo: 147.62,
    out: 5891.33,
    accounts: 12,
    settleNote: "5,891.33 USD out — 7.10 USD less than the plain pool, kept by LPs for carrying volatile flow.",
  },
  twap: {
    feeLabel: "0.30%",
    feeNote: "pool fee · oracle writes after",
    beforeTitle: "Nothing before the swap",
    beforeBody: "The TWAP appliance holds no before-swap permission, so the swap enters the CLMM untouched.",
    clmmBody: "40 SOL in at the pool's 0.30% fee moves the price from 148.20 to 147.61 — identical math to the plain pool.",
    afterTitle: "One observation, written",
    afterBody: "After the swap the appliance appends (slot, 147.61) to its ring buffer. Any program on-chain can now read a manipulation-resistant SOL/USD TWAP.",
    priceFrom: 148.2,
    priceTo: 147.61,
    out: 5898.43,
    accounts: 12,
    settleNote: "5,898.43 USD out — same as plain. The oracle costs takers nothing; it only writes its own account.",
  },
  range: {
    feeLabel: "0.30%",
    feeNote: "pool fee · 0.05% input surcharge",
    beforeTitle: "A surcharge is metered",
    beforeBody: "The range-order appliance meters a 0.05% input surcharge — its rated maximum — to fund keeper settlement of crossed orders.",
    clmmBody: "39.98 SOL (after surcharge) moves the price from 148.20 to 147.62. The crossing sweeps tick 147.80, where a 500-USD range order was resting.",
    afterTitle: "A crossed order fills",
    afterBody: "After the swap the appliance converts the crossed tick's liquidity: the resting order is now filled at its exact range, waiting for its owner to claim.",
    priceFrom: 148.2,
    priceTo: 147.62,
    out: 5895.48,
    accounts: 14,
    settleNote: "5,895.48 USD out. One maker got an exact-price fill without an order book existing anywhere.",
  },
  custom: {
    feeLabel: "0.30%",
    feeNote: "pool fee · your rules inside the rating",
    beforeTitle: "Your code runs first",
    beforeBody: "Whatever you shipped — an auction, a rebate, a whitelist window — runs here, inside the permissions the pool rated at creation. It cannot exceed them.",
    clmmBody: "The CLMM math is the same for everyone: your appliance shapes inputs and reacts to outputs, it never rewrites the curve.",
    afterTitle: "Your code settles up",
    afterBody: "After-swap is where your appliance accounts for what just happened — points, rebates, hedges, whatever the idea needs.",
    priceFrom: 148.2,
    priceTo: 147.61,
    out: 5898.43,
    accounts: 13,
    settleNote: "If your call fails, the whole swap reverts. Takers are never stuck holding half a trade.",
  },
};

/** Pipeline stages for the scroll walkthrough. */
export const STAGES = [
  { key: "router", label: "Router", title: "The router reads the pool's account list" },
  { key: "accounts", label: "Accounts", title: "Every swap has the same account shape" },
  { key: "before", label: "Before swap", title: "" }, // title from scenario
  { key: "clmm", label: "CLMM", title: "The CLMM math runs" },
  { key: "after", label: "After swap", title: "" },
  { key: "settle", label: "Settle", title: "Tokens settle once" },
] as const;
