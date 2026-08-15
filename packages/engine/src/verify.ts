import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

/**
 * Verifies an ed25519 wallet signature over an arbitrary canonical message
 * (see @attn/shared's submitPostMessage / bookAdMessage). Nobody can act
 * for a wallet they don't control.
 */
export function verifyWalletSignature(message: string, wallet: string, signatureBase58: string): boolean {
  let pubkeyBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    pubkeyBytes = new PublicKey(wallet).toBytes();
    sigBytes = bs58.decode(signatureBase58);
  } catch {
    return false;
  }
  if (sigBytes.length !== 64) return false;
  return nacl.sign.detached.verify(new TextEncoder().encode(message), sigBytes, pubkeyBytes);
}

/** Accepts only real X/Twitter status URLs. */
export function isValidPostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(u.hostname)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(u.pathname);
  } catch {
    return false;
  }
}

export function extractTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}
