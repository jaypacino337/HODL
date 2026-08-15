import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  BUYBACK_OFFSETS,
  CONFIG_OFFSETS,
  decodeBuybackConfig,
  decodeMintConfig,
  decodeVaultQueue,
} from "../../packages/pumpbrokers-site/lib/chain.ts";
import { decodeCoreAsset } from "../../packages/pumpbrokers-site/lib/coreAsset.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const SIZES: Record<string, number> = {
  u8: 1,
  bool: 1,
  u16: 2,
  u32: 4,
  u64: 8,
  Pubkey: 32,
};

/**
 * Recomputes the byte offsets the site decodes from, straight out of the Rust struct,
 * and asserts they match the hardcoded table. Add or reorder a field in Config and this
 * test fails — rather than the landing page quietly showing a wrong mint count because
 * `minted` moved two bytes.
 *
 * Stops at the first String, since everything after one is variable-length (and the
 * site does not read past that point).
 */
function offsetsOf(file: string, structName: string): Record<string, number> {
  const src = readFileSync(join(root, file), "utf8");
  const body = src.match(new RegExp(`pub struct ${structName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(body, `${structName} not found`);

  const out: Record<string, number> = {};
  let offset = 8; // Anchor account discriminator
  for (const m of body[1].matchAll(/pub (\w+):\s*([\w<>]+),/g)) {
    const [, field, ty] = m;
    const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = offset;
    if (ty === "String" || ty.startsWith("Vec")) break;
    assert.ok(SIZES[ty] !== undefined, `unhandled type "${ty}" on ${structName}.${field}`);
    offset += SIZES[ty];
  }
  return out;
}

test("Config offsets match the mint program's struct", () => {
  const derived = offsetsOf("programs/pumpbroker-mint/src/lib.rs", "Config");
  for (const [field, at] of Object.entries(CONFIG_OFFSETS)) {
    if (field === "baseUri") continue; // first String; boundary checked below
    assert.equal(at, derived[field], `Config.${field} offset drifted`);
  }
  assert.equal(CONFIG_OFFSETS.baseUri, derived.baseUri, "base_uri boundary drifted");
});

test("BuybackConfig offsets match the buyback program's struct", () => {
  const derived = offsetsOf("programs/pumpbroker-buyback/src/lib.rs", "BuybackConfig");
  for (const [field, at] of Object.entries(BUYBACK_OFFSETS)) {
    assert.equal(at, derived[field], `BuybackConfig.${field} offset drifted`);
  }
});

test("decodeMintConfig round-trips a synthetic account", () => {
  const buf = Buffer.alloc(400);
  buf[CONFIG_OFFSETS.isActive] = 1;
  buf[CONFIG_OFFSETS.delayedReveal] = 1;
  buf.writeBigUInt64LE(1_000_000_000_000n, CONFIG_OFFSETS.price);
  buf.writeUInt16LE(1000, CONFIG_OFFSETS.totalSupply);
  buf.writeUInt16LE(10, CONFIG_OFFSETS.honoraryCount);
  buf.writeUInt16LE(417, CONFIG_OFFSETS.minted);

  const cfg = decodeMintConfig(buf);
  assert.equal(cfg.price, 1_000_000_000_000n);
  assert.equal(cfg.totalSupply, 1000);
  assert.equal(cfg.honoraryCount, 10);
  assert.equal(cfg.minted, 417);
  assert.equal(cfg.isActive, true);
  assert.equal(cfg.delayedReveal, true);
  // An all-zero redeemer is the program's "PIECE 3 not connected" sentinel and must
  // decode to null, not to the system program address.
  assert.equal(cfg.redeemer, null);
});

test("a set redeemer decodes as connected", () => {
  const buf = Buffer.alloc(400);
  buf.fill(7, CONFIG_OFFSETS.redeemer, CONFIG_OFFSETS.redeemer + 32);
  assert.notEqual(decodeMintConfig(buf).redeemer, null);
});

test("decodeBuybackConfig reads payout and redeemed count", () => {
  const buf = Buffer.alloc(200);
  buf.writeBigUInt64LE(950_000_000_000n, BUYBACK_OFFSETS.payoutAmount);
  buf[BUYBACK_OFFSETS.isActive] = 1;
  buf.writeUInt32LE(23, BUYBACK_OFFSETS.redeemed);

  const cfg = decodeBuybackConfig(buf);
  assert.equal(cfg.payoutAmount, 950_000_000_000n);
  assert.equal(cfg.isActive, true);
  assert.equal(cfg.redeemed, 23);
});

test("decodeVaultQueue reads the FIFO of re-mintable brokers", () => {
  const buf = Buffer.alloc(64);
  buf.writeUInt32LE(3, 9);
  buf.writeUInt16LE(12, 13);
  buf.writeUInt16LE(400, 15);
  buf.writeUInt16LE(989, 17);
  assert.deepEqual(decodeVaultQueue(buf), [12, 400, 989]);
});

test("decodeCoreAsset reads owner, name and uri", () => {
  const owner = Buffer.alloc(32, 9);
  const name = Buffer.from("PumpBroker #418", "utf8");
  const uri = Buffer.from("https://arweave.net/x/417.json", "utf8");

  const buf = Buffer.concat([
    Buffer.from([1]), // Key::Asset
    owner,
    Buffer.from([1]), // UpdateAuthority::Address
    Buffer.alloc(32, 3),
    (() => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(name.length);
      return b;
    })(),
    name,
    (() => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(uri.length);
      return b;
    })(),
    uri,
  ]);

  const asset = decodeCoreAsset(buf);
  assert.ok(asset);
  assert.equal(asset.name, "PumpBroker #418");
  assert.equal(asset.uri, "https://arweave.net/x/417.json");
});

test("decodeCoreAsset rejects an account that is not a Core asset", () => {
  assert.equal(decodeCoreAsset(Buffer.alloc(200)), null);
  assert.equal(decodeCoreAsset(Buffer.from([1, 2, 3])), null);
});
