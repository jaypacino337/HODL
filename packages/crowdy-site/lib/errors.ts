/**
 * Program errors, in declaration order. Anchor numbers them from 6000.
 * `tests/unit/crowdy.test.ts` diffs this against the Rust `#[msg]` strings, so a
 * reordered variant fails a test instead of telling a user the wrong reason.
 */
export const CROWDY_ERRORS = [
  "Crowdy is paused. Existing campaigns still finalize and refund normally.",
  "You need to hold more of the token to take part.",
  "That token account isn't yours.",
  "Wrong token — that isn't the one Crowdy gates on.",
  "Only the campaign creator can do that.",
  "Give it a title.",
  "That summary is too long.",
  "That link is too long.",
  "The goal has to be more than zero.",
  "Campaigns run between 1 hour and 30 days.",
  "Amount has to be more than zero.",
  "This campaign isn't taking contributions.",
  "This campaign has ended.",
  "Too early — this campaign is still running and hasn't hit its goal.",
  "This campaign has already been settled.",
  "This campaign wasn't funded, so there's nothing for the creator to claim.",
  "Refunds are only open on campaigns that failed to hit their goal.",
  "You've already taken your refund.",
  "You didn't back this campaign.",
  "The vault doesn't hold enough to cover that.",
  "Platform fee cannot exceed 5%.",
  "Wrong fee destination.",
  "Arithmetic overflow.",
] as const;

const BASE = 6000;

export type DecodedError = { message: string; code: number | null; logs: string[] };

function codeFrom(logs: string[], raw: string): number | null {
  for (const l of logs) {
    const a = l.match(/Error Number:\s*(\d+)/);
    if (a) return Number(a[1]);
    const c = l.match(/custom program error:\s*(0x[0-9a-fA-F]+|\d+)/);
    if (c) return Number(c[1]);
  }
  const m =
    raw.match(/custom program error:\s*(0x[0-9a-fA-F]+|\d+)/) ??
    raw.match(/Error Number:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Never show "transaction failed". Every path here resolves to the program's own
 * message, a named wallet/network condition, or says plainly that we couldn't decode
 * it — and always keeps the raw logs.
 */
export function decodeError(err: unknown): DecodedError {
  const logs: string[] = (err as { logs?: string[] })?.logs ?? [];
  const raw = err instanceof Error ? err.message : String(err);
  const code = codeFrom(logs, raw);

  if (code !== null && code >= BASE) {
    const i = code - BASE;
    if (i >= 0 && i < CROWDY_ERRORS.length) {
      return { message: CROWDY_ERRORS[i], code, logs };
    }
  }

  if (/insufficient lamports|insufficient funds/i.test(raw)) {
    return {
      message: "Not enough SOL in your wallet to cover that plus network fees.",
      code,
      logs,
    };
  }
  if (/User rejected|rejected the request/i.test(raw)) {
    return { message: "You cancelled the transaction in your wallet.", code, logs };
  }
  if (/Blockhash not found|block height exceeded/i.test(raw)) {
    return {
      message: "The network dropped it before it landed. Nothing was charged — try again.",
      code,
      logs,
    };
  }
  if (/could not find account|AccountNotFound/i.test(raw)) {
    return {
      message:
        "You don't have a token account for the gate token yet — you'll need to hold some before you can take part.",
      code,
      logs,
    };
  }

  return {
    message: raw || "The transaction failed and the network did not say why.",
    code,
    logs,
  };
}
