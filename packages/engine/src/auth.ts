import { randomBytes } from "node:crypto";
import { verifyMessage } from "viem";

/**
 * Wallet-signature authentication for chat participation.
 *
 *   1. POST /auth/nonce {wallet}  → server-issued nonce (5 min expiry, one use)
 *   2. user signs the canonical message with personal_sign
 *   3. POST /chat {wallet, nonce, signature, body} → verified or rejected
 *
 * Nonces are single-use with expiry → replay protection. Rate limiting is a
 * token bucket per wallet AND per IP.
 */

const NONCE_TTL_MS = 5 * 60_000;
const nonces = new Map<string, { nonce: string; expires: number }>();

export function issueNonce(wallet: string): string {
  const nonce = randomBytes(16).toString("hex");
  nonces.set(wallet.toLowerCase(), { nonce, expires: Date.now() + NONCE_TTL_MS });
  return nonce;
}

export function chatSignMessage(wallet: string, nonce: string, body: string): string {
  // canonical, versioned message — what the wallet actually signs
  return `THE BOARDROOM chat v1\nwallet: ${wallet.toLowerCase()}\nnonce: ${nonce}\nmessage: ${body}`;
}

export async function verifyChatSignature(
  wallet: string,
  nonce: string,
  body: string,
  signature: string
): Promise<boolean> {
  const key = wallet.toLowerCase();
  const entry = nonces.get(key);
  if (!entry || entry.nonce !== nonce || entry.expires < Date.now()) return false;
  nonces.delete(key); // single use — replay protection
  try {
    return await verifyMessage({
      address: wallet as `0x${string}`,
      message: chatSignMessage(wallet, nonce, body),
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

// ── rate limiting (token bucket) ────────────────────────────────────────────

interface Bucket {
  tokens: number;
  last: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, perMinute: number, burst = perMinute): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: burst, last: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.last) / 60_000) * perMinute);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

/** Periodic cleanup so the maps can't grow unbounded. */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonces) if (v.expires < now) nonces.delete(k);
  for (const [k, v] of buckets) if (now - v.last > 10 * 60_000) buckets.delete(k);
}, 60_000).unref();
