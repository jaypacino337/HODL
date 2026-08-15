import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import {
  buybackInitializeIx,
  buybackSetActiveIx,
  initPoolIx,
  initializeIx,
  mintIx,
  revealIx,
  setActiveIx,
  setRedeemerIx,
} from "../../packages/pumpbrokers-site/lib/ix.ts";
import { HONORARY_COUNT, MINT_PRICE, TOTAL_SUPPLY } from "../../config/index.ts";

/**
 * Instruction payloads are hand-encoded, so the borsh layout is checked here rather
 * than discovered on chain. A wrong offset in `initialize` would not throw — it would
 * quietly configure the mint with the wrong price or the wrong supply, which is the
 * kind of bug you find out about from your holders.
 */

const AUTH = new PublicKey("11111111111111111111111111111112");
const MINT = new PublicKey("So11111111111111111111111111111111111111112");
const COLL = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const sighash = (n: string) =>
  createHash("sha256").update(`global:${n}`).digest().subarray(0, 8);

test("initialize encodes price, supply, flag and both URIs in order", () => {
  const baseUri = "https://arweave.net/abc/";
  const placeholder = "https://arweave.net/abc/placeholder.json";

  const ix = initializeIx({
    authority: AUTH,
    paymentMint: MINT,
    collection: COLL,
    price: MINT_PRICE,
    totalSupply: TOTAL_SUPPLY,
    honoraryCount: HONORARY_COUNT,
    delayedReveal: true,
    baseUri,
    placeholderUri: placeholder,
  });

  const d = ix.data;
  let o = 0;
  assert.deepEqual(d.subarray(o, (o += 8)), sighash("initialize"));
  assert.equal(d.readBigUInt64LE(o), MINT_PRICE);
  o += 8;
  assert.equal(d.readUInt16LE(o), TOTAL_SUPPLY);
  o += 2;
  assert.equal(d.readUInt16LE(o), HONORARY_COUNT);
  o += 2;
  assert.equal(d[o], 1, "delayed_reveal");
  o += 1;

  assert.equal(d.readUInt32LE(o), baseUri.length);
  o += 4;
  assert.equal(d.subarray(o, o + baseUri.length).toString("utf8"), baseUri);
  o += baseUri.length;

  assert.equal(d.readUInt32LE(o), placeholder.length);
  o += 4;
  assert.equal(d.subarray(o, o + placeholder.length).toString("utf8"), placeholder);
  o += placeholder.length;

  assert.equal(o, d.length, "no trailing bytes");
});

test("init_pool encodes a borsh Vec<u16>", () => {
  const indices = [0, 7, 999, 42];
  const d = initPoolIx(AUTH, indices).data;

  assert.deepEqual(d.subarray(0, 8), sighash("init_pool"));
  assert.equal(d.readUInt32LE(8), indices.length);
  indices.forEach((v, i) => assert.equal(d.readUInt16LE(12 + i * 2), v));
  assert.equal(d.length, 8 + 4 + indices.length * 2);
});

test("set_redeemer encodes Option<Pubkey> both ways", () => {
  const none = setRedeemerIx(AUTH, null).data;
  assert.equal(none.length, 9);
  assert.equal(none[8], 0, "None tag");

  const some = setRedeemerIx(AUTH, COLL).data;
  assert.equal(some.length, 8 + 1 + 32);
  assert.equal(some[8], 1, "Some tag");
  assert.equal(new PublicKey(some.subarray(9)).toBase58(), COLL.toBase58());
});

test("set_active encodes a bool", () => {
  assert.equal(setActiveIx(AUTH, true).data[8], 1);
  assert.equal(setActiveIx(AUTH, false).data[8], 0);
});

test("reveal encodes both u16 args", () => {
  const d = revealIx({ authority: AUTH, collection: COLL, mintNumber: 417, artIndex: 88 }).data;
  assert.deepEqual(d.subarray(0, 8), sighash("reveal"));
  assert.equal(d.readUInt16LE(8), 417);
  assert.equal(d.readUInt16LE(10), 88);
});

test("the buyback program's instructions carry its own program id", () => {
  const init = buybackInitializeIx(AUTH, 950_000_000_000n);
  const active = buybackSetActiveIx(AUTH, true);
  // Both programs declare `initialize` and `set_active`, so the discriminators are
  // identical by design — what separates them is the program id.
  assert.deepEqual(init.data.subarray(0, 8), sighash("initialize"));
  assert.equal(init.data.readBigUInt64LE(8), 950_000_000_000n);
  assert.equal(init.programId.toBase58(), active.programId.toBase58());
  assert.notEqual(init.programId.toBase58(), setActiveIx(AUTH, true).programId.toBase58());
});

test("mint marks exactly the accounts that must be writable", () => {
  const ix = mintIx({
    minter: AUTH,
    minterTokenAccount: MINT,
    paymentMint: MINT,
    collection: COLL,
    expectedNumber: 0,
  });

  assert.equal(ix.keys[0].isSigner, true, "minter signs");
  assert.equal(ix.keys[0].isWritable, true, "minter pays rent, so must be writable");
  // The asset account is created inside this instruction and must be writable.
  const asset = ix.keys[6];
  assert.equal(asset.isWritable, true);
  assert.equal(asset.isSigner, false, "the program signs for the asset PDA, not the client");
  // Nothing else may be a signer — a second required signature would break the
  // one-wallet mint flow.
  assert.equal(ix.keys.filter((k) => k.isSigner).length, 1);
});
