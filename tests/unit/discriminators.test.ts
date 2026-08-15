import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

/**
 * The site hand-builds Anchor instructions to keep @coral-xyz/anchor out of the
 * browser bundle. That is only safe if the hardcoded discriminators stay correct, so
 * this test re-derives every one of them from sha256("global:<name>") and also checks
 * that each name is a real `pub fn` in one of the two programs.
 *
 * Rename an instruction without updating lib/ix.ts and this fails, instead of the site
 * silently sending bytes no program dispatches.
 */
const sighash = (name: string): number[] =>
  Array.from(createHash("sha256").update(`global:${name}`).digest().subarray(0, 8));

const ixSource = readFileSync(
  join(root, "packages/pumpbrokers-site/lib/ix.ts"),
  "utf8",
);

function parseTable(): Record<string, number[]> {
  const block = ixSource.match(/export const DISCRIMINATOR = \{([\s\S]*?)\} as const;/);
  assert.ok(block, "DISCRIMINATOR table not found in lib/ix.ts");
  const out: Record<string, number[]> = {};
  for (const m of block[1].matchAll(/(\w+):\s*\[([\d,\s]+)\]/g)) {
    out[m[1]] = m[2].split(",").map((n) => Number(n.trim()));
  }
  return out;
}

const programSources = [
  readFileSync(join(root, "programs/pumpbroker-mint/src/lib.rs"), "utf8"),
  readFileSync(join(root, "programs/pumpbroker-buyback/src/lib.rs"), "utf8"),
].join("\n");

test("every discriminator matches sha256(global:<name>)", () => {
  const table = parseTable();
  assert.ok(Object.keys(table).length >= 14, "expected the full instruction set");
  for (const [name, bytes] of Object.entries(table)) {
    assert.deepEqual(bytes, sighash(name), `discriminator drifted for "${name}"`);
  }
});

test("every discriminator names an instruction that actually exists", () => {
  for (const name of Object.keys(parseTable())) {
    assert.match(
      programSources,
      new RegExp(`pub fn ${name}\\s*\\(`),
      `lib/ix.ts references "${name}" but no program declares it`,
    );
  }
});
