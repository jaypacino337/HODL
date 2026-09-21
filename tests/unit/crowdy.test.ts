import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import {
  FEE_BPS,
  GATE_AMOUNT,
  GATE_UNIT,
  LAMPORTS_PER_SOL,
  MAX_FEE_BPS,
  MAX_SUMMARY,
  MAX_TITLE,
  formatGate,
  formatSol,
  isConfigured,
  pctOfGoal,
  sol,
  timeLeft,
} from "../../config/crowdy.ts";
import {
  DISCRIMINATOR,
  cancelCampaignIx,
  claimFundsIx,
  contributeIx,
  createCampaignIx,
  finalizeIx,
  refundIx,
} from "../../packages/crowdy-site/lib/ix.ts";
import { CROWDY_ERRORS, decodeError } from "../../packages/crowdy-site/lib/errors.ts";
import { Reader, decodeCampaign } from "../../packages/crowdy-site/lib/chain.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const PROGRAM = readFileSync(join(root, "programs/crowdy-campaign/src/lib.rs"), "utf8");

const WALLET = new PublicKey("11111111111111111111111111111112");
const MINT = new PublicKey("So11111111111111111111111111111111111111112");
const sighash = (n: string) =>
  createHash("sha256").update(`global:${n}`).digest().subarray(0, 8);

// ---------------------------------------------------------------- config maths

test("SOL amounts are integer lamports", () => {
  assert.equal(LAMPORTS_PER_SOL, 1_000_000_000n);
  assert.equal(sol(1), LAMPORTS_PER_SOL);
  assert.equal(sol(0.5), 500_000_000n);
  assert.equal(typeof sol(2), "bigint");
});

test("the gate is 1,000,000 tokens in base units", () => {
  assert.equal(GATE_AMOUNT, 1_000_000n * GATE_UNIT);
  assert.equal(formatGate(GATE_AMOUNT), "1,000,000");
  assert.equal(formatGate(0n), "0");
});

test("formatSol trims trailing zeros and stays exact past 2^53", () => {
  assert.equal(formatSol(sol(1)), "1");
  assert.equal(formatSol(sol(1.5)), "1.5");
  assert.equal(formatSol(sol(0.25)), "0.25");
  assert.equal(formatSol(0n), "0");

  // 20 million SOL is 2e16 lamports, past Number.MAX_SAFE_INTEGER — this is exactly
  // why nothing in the amount pipeline touches a double.
  const huge = 20_000_000n * LAMPORTS_PER_SOL;
  assert.ok(huge > BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(formatSol(huge), "20,000,000");
});

test("pctOfGoal floors — 99.9% must never render as funded", () => {
  assert.equal(pctOfGoal(0n, sol(10)), 0);
  assert.equal(pctOfGoal(sol(5), sol(10)), 50);
  assert.equal(pctOfGoal(sol(9.99), sol(10)), 99);
  assert.equal(pctOfGoal(sol(10), sol(10)), 100);
  // Overfunded campaigns clamp for the bar's sake.
  assert.equal(pctOfGoal(sol(30), sol(10)), 100);
  // A zero goal is rejected on chain; the UI must not divide by it regardless.
  assert.equal(pctOfGoal(sol(1), 0n), 0);
});

test("timeLeft counts down and reports ended", () => {
  const now = 1_000_000;
  assert.equal(timeLeft(now + 60 * 30, now), "30m left");
  assert.equal(timeLeft(now + 3600 * 5, now), "5h 0m left");
  assert.equal(timeLeft(now + 86400 * 2 + 3600 * 4, now), "2d 4h left");
  assert.equal(timeLeft(now - 1, now), "ended");
  assert.equal(timeLeft(now, now), "ended");
});

test("the platform fee is within the program's hard ceiling", () => {
  assert.ok(FEE_BPS <= MAX_FEE_BPS);
  assert.equal(MAX_FEE_BPS, 500);
  // And the ceiling in config matches the one the program enforces.
  assert.match(PROGRAM, /MAX_FEE_BPS:\s*u16\s*=\s*500/);
});

test("isConfigured is false until a gate mint is set", () => {
  assert.equal(isConfigured(), false);
});

// ---------------------------------------------------------- program agreement

test("every discriminator matches sha256(global:<name>) and names a real fn", () => {
  for (const [name, bytes] of Object.entries(DISCRIMINATOR)) {
    assert.deepEqual(Array.from(sighash(name)), bytes, `discriminator drifted: ${name}`);
    assert.match(
      PROGRAM,
      new RegExp(`pub fn ${name}\\s*\\(`),
      `lib/ix.ts references "${name}" but the program has no such instruction`,
    );
  }
});

test("error table matches the Rust enum, in order", () => {
  const body = PROGRAM.match(/pub enum CrowdyError \{([\s\S]*?)\n\}/);
  assert.ok(body);
  const msgs = [...body[1].matchAll(/#\[msg\("((?:[^"\\]|\\.)*)"\)\]/g)].map((m) =>
    m[1].replace(/\\"/g, '"'),
  );
  assert.deepEqual([...CROWDY_ERRORS], msgs);
});

test("string limits agree with the program", () => {
  assert.match(PROGRAM, new RegExp(`MAX_TITLE:\\s*usize\\s*=\\s*${MAX_TITLE}`));
  assert.match(PROGRAM, new RegExp(`MAX_SUMMARY:\\s*usize\\s*=\\s*${MAX_SUMMARY}`));
});

// ------------------------------------------------------------------- encoding

test("create_campaign encodes three borsh strings then goal and duration", () => {
  const title = "Fund a billboard";
  const summary = "Times Square, one week.";
  const link = "https://example.com";

  const d = createCampaignIx({
    creator: WALLET,
    creatorGateAccount: MINT,
    campaignId: 0,
    title,
    summary,
    link,
    goalLamports: sol(10),
    durationSeconds: 604_800,
  }).data;

  let o = 0;
  assert.deepEqual(d.subarray(o, (o += 8)), sighash("create_campaign"));
  for (const s of [title, summary, link]) {
    assert.equal(d.readUInt32LE(o), Buffer.byteLength(s));
    o += 4;
    assert.equal(d.subarray(o, o + Buffer.byteLength(s)).toString("utf8"), s);
    o += Buffer.byteLength(s);
  }
  assert.equal(d.readBigUInt64LE(o), sol(10));
  o += 8;
  assert.equal(d.readBigInt64LE(o), 604_800n);
  o += 8;
  assert.equal(o, d.length, "no trailing bytes");
});

test("contribute encodes a u64 amount", () => {
  const d = contributeIx({
    backer: WALLET,
    backerGateAccount: MINT,
    campaignId: 3,
    amountLamports: sol(2.5),
  }).data;
  assert.deepEqual(d.subarray(0, 8), sighash("contribute"));
  assert.equal(d.readBigUInt64LE(8), 2_500_000_000n);
  assert.equal(d.length, 16);
});

test("argument-free instructions carry only their discriminator", () => {
  assert.equal(finalizeIx(WALLET, 0).data.length, 8);
  assert.equal(refundIx(WALLET, 0).data.length, 8);
  assert.equal(cancelCampaignIx(WALLET, 0).data.length, 8);
});

test("finalize is permissionless — the caller need not be writable or the creator", () => {
  const ix = finalizeIx(WALLET, 7);
  const signers = ix.keys.filter((k) => k.isSigner);
  assert.equal(signers.length, 1);
  assert.equal(signers[0].isWritable, false, "the caller pays only the fee");
  // Anyone can settle: the program checks no authority on this path, which is what
  // stops a vanished creator stranding backers in Active forever.
  assert.match(PROGRAM, /pub struct Finalize<'info> \{[\s\S]*?pub caller: Signer<'info>/);
});

test("refund marks the backer as the only signer and the vault as writable", () => {
  const ix = refundIx(WALLET, 1);
  assert.equal(ix.keys[0].pubkey.toBase58(), WALLET.toBase58());
  assert.equal(ix.keys[0].isSigner, true);
  assert.equal(ix.keys[2].isWritable, true, "vault must be writable to pay out");
  assert.equal(ix.keys[3].isWritable, true, "contribution must be writable to mark refunded");
});

test("claim_funds routes the fee to the configured destination", () => {
  const fee = new PublicKey("SysvarC1ock11111111111111111111111111111111");
  const ix = claimFundsIx({ creator: WALLET, campaignId: 2, feeDestination: fee });
  assert.ok(ix.keys.some((k) => k.pubkey.equals(fee) && k.isWritable));
});

test("campaign addresses are distinct per id", () => {
  const a = contributeIx({
    backer: WALLET,
    backerGateAccount: MINT,
    campaignId: 0,
    amountLamports: 1n,
  }).keys[2].pubkey;
  const b = contributeIx({
    backer: WALLET,
    backerGateAccount: MINT,
    campaignId: 1,
    amountLamports: 1n,
  }).keys[2].pubkey;
  assert.notEqual(a.toBase58(), b.toBase58());
});

// ------------------------------------------------------------------- decoding

test("decodeCampaign reads past the three variable-length strings", () => {
  const str = (s: string) => {
    const body = Buffer.from(s, "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32LE(body.length, 0);
    return Buffer.concat([len, body]);
  };
  const u64 = (n: bigint) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(n, 0);
    return b;
  };
  const i64 = (n: bigint) => {
    const b = Buffer.alloc(8);
    b.writeBigInt64LE(n, 0);
    return b;
  };
  const u32 = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n, 0);
    return b;
  };

  const data = Buffer.concat([
    Buffer.alloc(8), // discriminator
    Buffer.from([254, 253]), // bump, vault_bump
    u64(42n), // id
    WALLET.toBuffer(), // creator
    str("Billboard"),
    str("A summary."),
    str(""), // empty link — the variable-length edge case
    u64(sol(10)), // goal
    u64(sol(7.5)), // raised
    u32(12), // backer_count
    i64(1_700_000_000n), // created_at
    i64(1_700_600_000n), // deadline
    Buffer.from([2]), // status = Failed
  ]);

  const c = decodeCampaign(data, "addr");
  assert.equal(c.id, 42);
  assert.equal(c.creator, WALLET.toBase58());
  assert.equal(c.title, "Billboard");
  assert.equal(c.summary, "A summary.");
  assert.equal(c.link, "");
  assert.equal(c.goal, sol(10));
  assert.equal(c.raised, sol(7.5));
  assert.equal(c.backerCount, 12);
  assert.equal(c.deadline, 1_700_600_000);
  assert.equal(c.status, "Failed");
});

test("Reader advances correctly across mixed types", () => {
  const b = Buffer.concat([Buffer.alloc(8), Buffer.from([1, 0]), Buffer.alloc(2)]);
  b.writeUInt16LE(513, 10);
  const r = new Reader(b);
  assert.equal(r.u8(), 1);
  assert.equal(r.bool(), false);
  assert.equal(r.u16(), 513);
});

// --------------------------------------------------------------------- errors

test("decodeError resolves a program code to its message", () => {
  const err = Object.assign(new Error("x"), {
    logs: ["Program log: AnchorError ... Error Number: 6001."],
  });
  assert.equal(decodeError(err).message, "You need to hold more of the token to take part.");
  assert.equal(decodeError(err).code, 6001);
});

test("decodeError reads a hex custom program error", () => {
  // 0x1776 = 6006 = BadSummary
  const d = decodeError(new Error("custom program error: 0x1776"));
  assert.equal(d.code, 6006);
  assert.equal(d.message, "That summary is too long.");
});

test("decodeError names wallet and network conditions instead of swallowing them", () => {
  assert.match(decodeError(new Error("User rejected the request.")).message, /cancelled/i);
  assert.match(decodeError(new Error("Blockhash not found")).message, /Nothing was charged/);
  assert.match(decodeError(new Error("insufficient lamports")).message, /Not enough SOL/);
});

test("an undecodable failure still says something true", () => {
  const d = decodeError(new Error(""));
  assert.equal(d.message, "The transaction failed and the network did not say why.");
  assert.equal(d.code, null);
});
