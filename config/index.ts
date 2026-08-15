/**
 * PumpBrokers — the single source of truth.
 *
 * Every address, price and supply number in the project lives here. Nothing else in
 * the repo is allowed to hardcode one. If you find a literal `1000` or a base58 string
 * in a component, a script or a test, it is a bug.
 *
 * Two rules that this file enforces rather than documents:
 *
 *   1. TOKEN AMOUNTS ARE INTEGER BASE UNITS, ALWAYS. There is not a single float in
 *      this file and there must not be one anywhere near an amount. Display formatting
 *      is the only place decimals get divided out, and it is done with BigInt string
 *      arithmetic in `formatTokens` — never `Number()`.
 *
 *   2. UNSET VALUES FAIL LOUDLY. Anything we do not know yet is `null`, and
 *      `assertDeployReady()` refuses to let a script touch a cluster while one is
 *      still null. A misconfigured mainnet mint is unrecoverable; a thrown error is
 *      free.
 */

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * $PUMPBROKER SPL mint.
 *
 * STILL UNSET — pending from the owner. Scripts refuse to run against mainnet until
 * this is filled in. Devnet tests mint their own throwaway token instead.
 */
export const PUMPBROKER_MINT: string | null =
  process.env.NEXT_PUBLIC_PUMPBROKER_MINT ?? null;

/**
 * $PUMPBROKER decimals.
 *
 * 6 is the pump.fun default and what every number below assumes. If the token turns
 * out to be 9, change ONLY this constant — every amount in the project is derived from
 * it, so nothing else needs editing.
 */
export const PUMPBROKER_DECIMALS = 6;

/** 10n ** decimals, as a BigInt. The unit multiplier for all amounts. */
export const ONE_TOKEN = 10n ** BigInt(PUMPBROKER_DECIMALS);

/** Convert a whole-token count to base units. Integer in, integer out. */
export const tokens = (whole: bigint | number): bigint => BigInt(whole) * ONE_TOKEN;

// ---------------------------------------------------------------------------
// Economics — all base units
// ---------------------------------------------------------------------------

/** Mint price: 1,000,000 $PUMPBROKER. */
export const MINT_PRICE = tokens(1_000_000);

/** Buyback payout: 950,000 $PUMPBROKER. */
export const BUYBACK_PAYOUT = tokens(950_000);

/**
 * The spread the treasury keeps per round trip: 50,000 $PUMPBROKER.
 * Derived, never typed twice.
 */
export const ROUND_TRIP_SPREAD = MINT_PRICE - BUYBACK_PAYOUT;

// ---------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------

/** Hard cap. Mirrored by `MAX_TOTAL_SUPPLY` in the mint program. */
export const TOTAL_SUPPLY = 1_000;

/** Minted outside the program by PIECE 1. These count toward TOTAL_SUPPLY. */
export const HONORARY_COUNT = 10;

/** What the public mint can actually sell. */
export const PUBLIC_SUPPLY = TOTAL_SUPPLY - HONORARY_COUNT;

/**
 * Which of the 1,000 art indices went out as honoraries.
 *
 * STILL UNSET — pending from the owner. `init_pool` will reject a list whose length
 * does not equal HONORARY_COUNT, so a wrong guess here cannot silently ship.
 */
export const HONORARY_INDICES: number[] | null = null;

// ---------------------------------------------------------------------------
// Programs and accounts
// ---------------------------------------------------------------------------

/** Placeholder program ids. Replaced at first deploy — see docs/LAUNCH_RUNBOOK.md. */
export const MINT_PROGRAM_ID = "8MziWLhyk1oWYM6di5eMsS9JAxXxfLgjXBKHb8NCSCKf";
export const BUYBACK_PROGRAM_ID = "98ECcFgwqei1mMnhvBjCxmqdZtA6GxVPF3iSKjWvwF4d";

/** Metaplex Core. Same address on every cluster. */
export const MPL_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

/** The mpl-core collection, created by scripts/create-collection.ts. */
export const COLLECTION_ADDRESS: string | null =
  process.env.NEXT_PUBLIC_COLLECTION_ADDRESS ?? null;

/** PDA seeds. Must match the `*_SEED` constants in the two programs byte for byte. */
export const SEEDS = {
  config: "config",
  pool: "pool",
  asset: "asset",
  vault: "vault",
  treasury: "treasury",
  buyback: "buyback",
} as const;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Base URI for the 1,000 metadata JSON files. Must end in a slash — the program
 * builds `${base}${artIndex}.json`.
 */
export const METADATA_BASE_URI: string | null =
  process.env.NEXT_PUBLIC_METADATA_BASE_URI ?? null;

/**
 * Shown on every asset between mint and reveal.
 *
 * Delayed reveal is on because any on-chain randomness can be simulated before it is
 * sent. With 100 airdrop-bearing pieces, a sniper would simulate a mint, check whether
 * it drew a GMEx, and drop the transaction if not — free re-rolls until they take the
 * valuable pieces. Nobody can pre-simulate a mapping that does not exist yet.
 */
export const PLACEHOLDER_URI: string | null =
  process.env.NEXT_PUBLIC_PLACEHOLDER_URI ?? null;

export const DELAYED_REVEAL = true;

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------

/**
 * The Helius key is server-side only. `HELIUS_API_KEY` has no NEXT_PUBLIC_ prefix, so
 * Next.js will not inline it into the client bundle. The browser talks to our own
 * /api/rpc route, which proxies to Helius. There is no code path that puts a key or a
 * private key in front of a user.
 */
export const RPC_PROXY_PATH = "/api/rpc";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta";

export const EXPLORER_BASE =
  CLUSTER === "mainnet-beta"
    ? "https://solscan.io"
    : "https://solscan.io/?cluster=devnet";

// ---------------------------------------------------------------------------
// Airdrop tickers — data only. The airdrop tool itself is not built yet.
// ---------------------------------------------------------------------------

/**
 * 100 of the 1,000 carry an `Airdrop` attribute naming a tokenized stock.
 *
 * Only GMEx is verified. Every other mint is `null` and MUST stay null until someone
 * confirms it against a primary source — the airdrop tool is required to refuse to run
 * for any ticker whose mint is still null, which is why they are typed as nullable
 * rather than left as empty strings.
 */
export const AIRDROP_TICKERS: Record<string, { mint: string | null; verified: boolean }> = {
  GMEx: { mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc", verified: true },
  TSLAx: { mint: null, verified: false },
  NVDAx: { mint: null, verified: false },
  MSTRx: { mint: null, verified: false },
  HOODx: { mint: null, verified: false },
  COINx: { mint: null, verified: false },
  CRCLx: { mint: null, verified: false },
  AAPLx: { mint: null, verified: false },
  METAx: { mint: null, verified: false },
  SPYx: { mint: null, verified: false },
};

// ---------------------------------------------------------------------------
// Design tokens — mirrored in tailwind.config.ts, defined once here.
// ---------------------------------------------------------------------------

export const COLORS = {
  neon: "#22FF6A",
  pump: "#1FCB4F",
  ink: "#0A0D10",
  bone: "#F2F4F0",
  down: "#E4322B",
} as const;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export class ConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Refusing to run: ${missing.length} required config value(s) still unset — ` +
        `${missing.join(", ")}. Fill them in config/index.ts (or the matching env var) first.`,
    );
    this.name = "ConfigError";
  }
}

/**
 * Call this at the top of every script that touches a cluster. It is the difference
 * between "the mint is live with a placeholder URI" and a thrown error.
 */
export function assertDeployReady(): void {
  const missing: string[] = [];
  if (!PUMPBROKER_MINT) missing.push("PUMPBROKER_MINT");
  if (!COLLECTION_ADDRESS) missing.push("COLLECTION_ADDRESS");
  if (!METADATA_BASE_URI) missing.push("METADATA_BASE_URI");
  if (DELAYED_REVEAL && !PLACEHOLDER_URI) missing.push("PLACEHOLDER_URI");
  if (!HONORARY_INDICES) missing.push("HONORARY_INDICES");
  if (missing.length) throw new ConfigError(missing);
}

/** True when the site has enough config to talk to a live mint. */
export function isLive(): boolean {
  return Boolean(PUMPBROKER_MINT && COLLECTION_ADDRESS);
}

// ---------------------------------------------------------------------------
// Display formatting — BigInt only, no Number() on an amount, ever.
// ---------------------------------------------------------------------------

/**
 * Format base units for display. `1_000_000_000_000n` -> `"1,000,000"`.
 *
 * Deliberately does not go through `Number`: 2^53 base units is only ~9 billion
 * tokens at 6 decimals, which a treasury can exceed.
 */
export function formatTokens(base: bigint, opts: { decimals?: number } = {}): string {
  const show = opts.decimals ?? 0;
  const neg = base < 0n;
  const abs = neg ? -base : base;

  const whole = abs / ONE_TOKEN;
  const frac = abs % ONE_TOKEN;

  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (show === 0) return (neg ? "-" : "") + grouped;

  const fracStr = frac.toString().padStart(PUMPBROKER_DECIMALS, "0").slice(0, show);
  return `${neg ? "-" : ""}${grouped}.${fracStr}`;
}

/** How many buybacks the treasury can currently cover. Integer division, no floats. */
export function redemptionsAvailable(treasuryBase: bigint): number {
  if (BUYBACK_PAYOUT === 0n) return 0;
  return Number(treasuryBase / BUYBACK_PAYOUT);
}
