/**
 * Minimal mpl-core Asset decoder.
 *
 * We only need owner / name / uri, and decoding them by offset means the site works on
 * any plain RPC endpoint — no DAS indexer, no Helius-specific method, nothing to break
 * if we change providers. Every broker's address is a PDA of its mint number, so the
 * whole collection can be read by deriving 1,000 addresses and batching them.
 *
 * Layout (borsh):
 *   0        u8      key discriminator (1 = Asset)
 *   1..33    Pubkey  owner
 *   33       u8      UpdateAuthority variant (0 None, 1 Address, 2 Collection)
 *   [+32]            the pubkey, present for variants 1 and 2
 *   then     u32 len + utf8  name
 *   then     u32 len + utf8  uri
 */

export const CORE_ASSET_KEY = 1;

export type CoreAsset = { owner: string; name: string; uri: string };

export function decodeCoreAsset(data: Uint8Array): CoreAsset | null {
  if (data.length < 34 || data[0] !== CORE_ASSET_KEY) return null;
  const buf = Buffer.from(data);

  const owner = base58(buf.subarray(1, 33));

  let o = 33;
  const uaVariant = buf[o];
  o += 1;
  if (uaVariant === 1 || uaVariant === 2) o += 32;

  const readStr = (): string | null => {
    if (o + 4 > buf.length) return null;
    const len = buf.readUInt32LE(o);
    o += 4;
    if (len > 1024 || o + len > buf.length) return null;
    const s = buf.subarray(o, o + len).toString("utf8");
    o += len;
    return s;
  };

  const name = readStr();
  const uri = readStr();
  if (name === null || uri === null) return null;

  return { owner, name, uri };
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Local base58 so this module can be used without pulling in web3.js. */
export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out || "1";
}
