import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  BUYBACK_ERRORS,
  MINT_ERRORS,
  RACED_CODE,
  decodeError,
} from "../../packages/pumpbrokers-site/lib/errors.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

/**
 * Anchor numbers errors from 6000 in declaration order. The site's message tables must
 * therefore match the Rust enums exactly — in content AND in order. A reordered variant
 * would silently show users the wrong reason their transaction failed, which is a worse
 * failure than showing nothing.
 */
function msgsFrom(file: string, enumName: string): string[] {
  const src = readFileSync(join(root, file), "utf8");
  const body = src.match(new RegExp(`pub enum ${enumName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(body, `${enumName} not found in ${file}`);
  return [...body[1].matchAll(/#\[msg\("((?:[^"\\]|\\.)*)"\)\]/g)].map((m) =>
    m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
  );
}

test("mint error table matches the Rust enum, in order", () => {
  assert.deepEqual(
    [...MINT_ERRORS],
    msgsFrom("programs/pumpbroker-mint/src/lib.rs", "MintError"),
  );
});

test("buyback error table matches the Rust enum, in order", () => {
  assert.deepEqual(
    [...BUYBACK_ERRORS],
    msgsFrom("programs/pumpbroker-buyback/src/lib.rs", "BuybackError"),
  );
});

test("RACED_CODE points at MintRaced", () => {
  assert.equal(RACED_CODE, 6001);
  assert.equal(MINT_ERRORS[RACED_CODE - 6000], MINT_ERRORS[1]);
  assert.match(MINT_ERRORS[1], /Someone else took that broker/);
});

test("decodeError reads the code out of Anchor logs", () => {
  const err = Object.assign(new Error("failed"), {
    logs: [
      "Program log: AnchorError occurred. Error Code: MintPaused. Error Number: 6000. Error Message: The mint is paused.",
    ],
  });
  const d = decodeError(err, "mint");
  assert.equal(d.code, 6000);
  assert.equal(d.message, "The mint is paused.");
  assert.equal(d.retryable, false);
});

test("decodeError reads a raw custom program error in hex", () => {
  // 0x1771 = 6001 = MintRaced, and it is the one error the client retries.
  const d = decodeError(new Error("custom program error: 0x1771"), "mint");
  assert.equal(d.code, 6001);
  assert.equal(d.retryable, true);
});

test("the same code means different things in the two programs", () => {
  const err = Object.assign(new Error("x"), {
    logs: ["Program log: AnchorError ... Error Number: 6001."],
  });
  assert.match(decodeError(err, "mint").message, /Someone else took that broker/);
  assert.match(decodeError(err, "buyback").message, /treasury can't cover a buyback/);
});

test("a wallet rejection is not reported as a program failure", () => {
  const d = decodeError(new Error("User rejected the request."), "mint");
  assert.equal(d.message, "You cancelled the transaction in your wallet.");
});

test("an undecodable failure still says something true", () => {
  const d = decodeError(new Error(""), "mint");
  assert.equal(d.message, "The transaction failed and the network did not say why.");
  assert.equal(d.code, null);
});
