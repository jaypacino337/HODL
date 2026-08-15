import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUYBACK_PAYOUT,
  HONORARY_COUNT,
  MINT_PRICE,
  ONE_TOKEN,
  PUBLIC_SUPPLY,
  PUMPBROKER_DECIMALS,
  ROUND_TRIP_SPREAD,
  TOTAL_SUPPLY,
  assertDeployReady,
  formatTokens,
  redemptionsAvailable,
  tokens,
} from "../../config/index.ts";

test("prices are integer base units, not display units", () => {
  assert.equal(typeof MINT_PRICE, "bigint");
  assert.equal(typeof BUYBACK_PAYOUT, "bigint");
  assert.equal(ONE_TOKEN, 10n ** BigInt(PUMPBROKER_DECIMALS));
  assert.equal(MINT_PRICE, 1_000_000n * ONE_TOKEN);
  assert.equal(BUYBACK_PAYOUT, 950_000n * ONE_TOKEN);
});

test("the round-trip spread is 50,000 and is derived, not typed twice", () => {
  assert.equal(ROUND_TRIP_SPREAD, tokens(50_000));
  assert.equal(ROUND_TRIP_SPREAD, MINT_PRICE - BUYBACK_PAYOUT);
});

test("payout is strictly below mint price — otherwise the treasury drains", () => {
  // The buyback program enforces this on chain too (PayoutExceedsMintPrice).
  assert.ok(BUYBACK_PAYOUT < MINT_PRICE);
});

test("supply adds up: 10 honoraries count toward the 1,000 cap", () => {
  assert.equal(TOTAL_SUPPLY, 1000);
  assert.equal(HONORARY_COUNT, 10);
  assert.equal(PUBLIC_SUPPLY, 990);
  assert.equal(PUBLIC_SUPPLY + HONORARY_COUNT, TOTAL_SUPPLY);
});

test("formatTokens is exact at the sizes this project actually reaches", () => {
  // A fully minted treasury is 990 x 1,000,000 = 990,000,000 tokens, i.e. 9.9e14 base
  // units. That still fits a double exactly (MAX_SAFE_INTEGER is ~9.0e15), so BigInt
  // is not strictly required here — it is defence in depth, not a live bug fix.
  const full = 990n * MINT_PRICE;
  assert.equal(formatTokens(full), "990,000,000");
  assert.equal(formatTokens(MINT_PRICE), "1,000,000");
  assert.equal(formatTokens(0n), "0");
  assert.equal(formatTokens(tokens(1) + 500_000n, { decimals: 2 }), "1.50");
});

test("formatTokens stays exact past the range where Number does not", () => {
  // The reason the whole pipeline is BigInt: a token with 9 decimals, or any balance
  // past 2^53 base units, silently rounds the moment it touches a double.
  const huge = 12_345_678_901_234_567_890n;
  assert.ok(huge > BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(formatTokens(huge), "12,345,678,901,234");
  // The same value through a double loses the low-order digits outright.
  assert.notEqual(String(Number(huge)), huge.toString());
});

test("redemptionsAvailable floors — no partial payouts", () => {
  assert.equal(redemptionsAvailable(0n), 0);
  assert.equal(redemptionsAvailable(BUYBACK_PAYOUT - 1n), 0);
  assert.equal(redemptionsAvailable(BUYBACK_PAYOUT), 1);
  assert.equal(redemptionsAvailable(BUYBACK_PAYOUT * 3n + 1n), 3);
});

test("assertDeployReady refuses to run while config is unset", () => {
  // This is the guard that stops a mainnet mint going live pointed at nothing.
  assert.throws(() => assertDeployReady(), /Refusing to run/);
});
