import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { pickMessage, Side } from "@hodl/shared";

/**
 * Verifies that `wallet` really signed this round's pick message. The
 * website asks the connected wallet to signMessage() the exact string from
 * pickMessage(); we re-derive it here and check the ed25519 signature, so
 * nobody can submit picks for wallets they don't control.
 */
export function verifyPickSignature(
  roundNumber: number,
  side: Side,
  wallet: string,
  signatureBase58: string
): boolean {
  let pubkeyBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    pubkeyBytes = new PublicKey(wallet).toBytes();
    sigBytes = bs58.decode(signatureBase58);
  } catch {
    return false;
  }
  if (sigBytes.length !== 64) return false;
  const message = new TextEncoder().encode(pickMessage(roundNumber, side, wallet));
  return nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
}
