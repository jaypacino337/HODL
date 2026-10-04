/**
 * Sentia domain data: the two agent archetypes, fee routing presets, the
 * example roster, and the per-archetype "follow one fee" stages. One source
 * of truth for the launch demo and the scroll flow.
 */

export type Archetype = "influencer" | "trader";

export interface ArchetypeDef {
  id: Archetype;
  label: string;
  tag: string;
  color: string;
  blurb: string;
  dialLabel: string;
  dials: [string, string, string];
  fuelLabel: string;
  fuelBlurb: string;
  acts: string[];
}

export const ARCHETYPES: Record<Archetype, ArchetypeDef> = {
  influencer: {
    id: "influencer",
    label: "AI influencer",
    tag: "content",
    color: "#FF4D8D",
    blurb: "A face, a voice and a feed. It studies what's trending, makes the video and posts on schedule — you run the brand.",
    dialLabel: "Persona",
    dials: ["Wholesome", "Bold", "Unhinged"],
    fuelLabel: "Production fuel",
    fuelBlurb: "Fee share that pays for generation and posting: video renders, voice, captions, scheduling. The feed never runs out of budget while the token trades.",
    acts: ["studies the trend board", "renders a video in its identity", "posts and replies in character"],
  },
  trader: {
    id: "trader",
    label: "AI trader",
    tag: "markets",
    color: "#3DF08C",
    blurb: "A strategy with a wallet. It runs its playbook on-chain within hard risk limits — every position public, every trade receipted.",
    dialLabel: "Playbook",
    dials: ["Conservative", "Momentum", "Degen"],
    fuelLabel: "Bankroll fuel",
    fuelBlurb: "Fee share that feeds the agent's trading bankroll. Realized profits buy its own token back on the curve — performance is the marketing.",
    acts: ["scans its market universe", "sizes a position inside its risk caps", "books the trade with a public receipt"],
  },
};

/** Fee routing presets a launcher picks from. Always sums to 100. */
export interface FeeSplit {
  id: string;
  name: string;
  burn: number; // buy & burn $SENTIA
  fuel: number; // the agent's own budget (production or bankroll)
  creator: number; // the launcher
  pad: number; // Sentia treasury
}

export const FEE_PRESETS: FeeSplit[] = [
  { id: "balanced", name: "Balanced", burn: 30, fuel: 30, creator: 30, pad: 10 },
  { id: "builder", name: "Fuel-max", burn: 20, fuel: 50, creator: 20, pad: 10 },
  { id: "burner", name: "Burn-max", burn: 50, fuel: 25, creator: 15, pad: 10 },
];

export interface RosterAgent {
  name: string;
  ticker: string;
  archetype: Archetype;
  dial: string;
  stat1: string;
  stat2: string;
  note: string;
}

/** EXAMPLES — rendered only under an explicit "example roster" label. */
export const EXAMPLE_ROSTER: RosterAgent[] = [
  { name: "Mara Vox", ticker: "MARA", archetype: "influencer", dial: "Bold", stat1: "214K followers", stat2: "3 posts/day", note: "streetwear fit-checks, deadpan voiceovers" },
  { name: "Chef Byte", ticker: "BYTE", archetype: "influencer", dial: "Wholesome", stat1: "88K followers", stat2: "1 post/day", note: "cursed recipes, cooked earnestly" },
  { name: "Delta One", ticker: "DELTA", archetype: "trader", dial: "Momentum", stat1: "+34.2% (90d)", stat2: "61% win rate", note: "SOL majors breakout playbook" },
  { name: "Basis Bob", ticker: "BASIS", archetype: "trader", dial: "Conservative", stat1: "+9.8% (90d)", stat2: "max DD 2.1%", note: "funding-rate harvest, hedged" },
  { name: "Glow", ticker: "GLOW", archetype: "influencer", dial: "Unhinged", stat1: "402K followers", stat2: "5 posts/day", note: "3am lore drops, replies to everyone" },
  { name: "Mev Mother", ticker: "MEVM", archetype: "trader", dial: "Degen", stat1: "+212% (90d)", stat2: "max DD 38%", note: "new-pair sniper, capped bankroll" },
];

/** Stages for the scroll-driven "follow one fee". */
export interface FeeStage {
  label: string;
  title: string;
  body: (a: ArchetypeDef, split: FeeSplit) => string;
}

export const FEE_STAGES: FeeStage[] = [
  {
    label: "Trade",
    title: "Someone trades the token",
    body: (a) => `A buy hits ${a.id === "influencer" ? "$MARA" : "$DELTA"}'s bonding curve. Like every trade on Sentia, it pays a 1% fee — this is the only place anything is charged.`,
  },
  {
    label: "Collect",
    title: "The fee lands in the router",
    body: () => "Fees pool in the agent's fee router — a program with exactly one ability: split by the ratios fixed at launch. Nobody can redirect it afterward, including us.",
  },
  {
    label: "Burn",
    title: "A share burns $SENTIA",
    body: (_a, s) => `${s.burn}% market-buys $SENTIA and burns it. Every agent on the pad — influencer or trader, hit or flop — pushes the same supply downward.`,
  },
  {
    label: "Fuel",
    title: "",
    body: (a, s) => `${s.fuel}% goes to ${a.fuelLabel.toLowerCase()}: ${a.fuelBlurb.split(":")[1]?.trim() ?? a.fuelBlurb}`,
  },
  {
    label: "Creator",
    title: "The creator gets paid",
    body: (_a, s) => `${s.creator}% streams to the launcher's wallet, claimable any time — plus ${s.pad}% to the Sentia treasury for infra and listings.`,
  },
  {
    label: "Act",
    title: "The agent goes to work",
    body: (a) => `Fueled up, the agent ${a.acts[0]}, ${a.acts[1]}, and ${a.acts[2]}. Activity draws volume; volume pays fees; fees buy fuel and burn supply. That's the flywheel.`,
  },
];

export function tickerFromName(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned.slice(0, 6) || "AGENT").slice(0, 6);
}
