/**
 * Turns a Solana RPC failure into something a human can act on.
 *
 * "Transaction failed" is not an acceptable thing to show a user who just tried to
 * spend a million tokens. Every path here either resolves to a real program error
 * message or says plainly that we could not decode it — and keeps the raw logs so the
 * user can paste them at us.
 *
 * The two tables below MUST stay in the same order as the `#[error_code]` enums in the
 * programs; Anchor numbers them from 6000 by declaration order.
 * `tests/errors.test.ts` diffs them against the Rust source, so a reorder fails a test.
 */

export const MINT_ERRORS = [
  "The mint is paused.",
  "Someone else took that broker a moment before you. Try again — your next number is ready.",
  "Sold out. All 1,000 brokers are claimed.",
  "You don't have enough $PUMPBROKER for the mint price.",
  "Only the mint authority can do that.",
  "That is not the pending authority.",
  "Price must be greater than zero.",
  "Supply must be between 1 and 1,000, and honorary count must be lower than it.",
  "Amount must be greater than zero.",
  "Metadata URI is too long.",
  "The mint has not been configured yet.",
  "The art pool has not been seeded yet.",
  "The art pool has already been seeded.",
  "The pool cannot be re-seeded after minting has started.",
  "Honorary index list does not match the configured honorary count.",
  "Duplicate honorary index.",
  "Art index is outside the collection.",
  "Seeded pool size does not match total supply minus honoraries.",
  "Wrong token mint for this collection.",
  "Wrong treasury account.",
  "Wrong collection account.",
  "Wrong Metaplex Core program.",
  "Could not read the SlotHashes sysvar.",
  "Delayed reveal is not enabled for this collection.",
  "That broker has not been minted.",
  "Reveal does not match the art index drawn on chain at mint time.",
  "The buyback program is not connected. Redemption is off.",
  "There are no brokers in the vault to re-mint.",
  "That broker is already in the vault.",
  "The vault is full.",
  "The treasury cannot cover this payout right now.",
  "Arithmetic overflow.",
] as const;

export const BUYBACK_ERRORS = [
  "Sell-back is paused right now.",
  "The treasury can't cover a buyback right now. Check back after more brokers are minted.",
  "The mint program has not connected this buyback program yet.",
  "Payout must be less than the mint price — otherwise the treasury drains on every round trip.",
  "Only the buyback authority can do that.",
  "That is not the pending authority.",
  "Amount must be greater than zero.",
  "Wrong mint config account.",
  "Wrong token mint.",
  "Wrong treasury account.",
  "Wrong collection account.",
  "Wrong Metaplex Core program.",
  "Arithmetic overflow.",
] as const;

const ANCHOR_ERROR_BASE = 6000;

/** MintError::MintRaced — the one error the client retries instead of showing. */
export const RACED_CODE = ANCHOR_ERROR_BASE + 1;

export type DecodedError = {
  message: string;
  code: number | null;
  retryable: boolean;
  logs: string[];
};

function codeFromLogs(logs: string[]): number | null {
  for (const line of logs) {
    // Anchor: "Program log: AnchorError ... Error Number: 6003."
    const anchor = line.match(/Error Number:\s*(\d+)/);
    if (anchor) return Number(anchor[1]);
    // Runtime: "custom program error: 0x1773"
    const custom = line.match(/custom program error:\s*(0x[0-9a-fA-F]+|\d+)/);
    if (custom) return Number(custom[1]);
  }
  return null;
}

function codeFromMessage(msg: string): number | null {
  const m =
    msg.match(/custom program error:\s*(0x[0-9a-fA-F]+|\d+)/) ??
    msg.match(/Error Number:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * `which` selects the table — a code of 6001 means something different in each
 * program, so we must know which one threw.
 */
export function decodeError(
  err: unknown,
  which: "mint" | "buyback" = "mint",
): DecodedError {
  const logs: string[] =
    (err as { logs?: string[] })?.logs ??
    (err as { transactionLogs?: string[] })?.transactionLogs ??
    [];
  const raw = err instanceof Error ? err.message : String(err);

  const code = codeFromLogs(logs) ?? codeFromMessage(raw);
  const table = which === "mint" ? MINT_ERRORS : BUYBACK_ERRORS;

  if (code !== null && code >= ANCHOR_ERROR_BASE) {
    const idx = code - ANCHOR_ERROR_BASE;
    if (idx >= 0 && idx < table.length) {
      return {
        message: table[idx],
        code,
        retryable: which === "mint" && code === RACED_CODE,
        logs,
      };
    }
  }

  // Common non-program failures, named rather than swallowed.
  if (/insufficient lamports|insufficient funds for rent/i.test(raw)) {
    return {
      message:
        "Not enough SOL to cover network rent for your broker's account (~0.0025 SOL). Top up and try again.",
      code,
      retryable: false,
      logs,
    };
  }
  if (/User rejected|rejected the request/i.test(raw)) {
    return { message: "You cancelled the transaction in your wallet.", code, retryable: false, logs };
  }
  if (/Blockhash not found|block height exceeded/i.test(raw)) {
    return {
      message: "The network dropped the transaction before it landed. Nothing was charged — try again.",
      code,
      retryable: true,
      logs,
    };
  }

  return {
    message: raw || "The transaction failed and the network did not say why.",
    code,
    retryable: false,
    logs,
  };
}
