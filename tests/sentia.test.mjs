import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHETYPES, EXAMPLE_ROSTER, FEE_PRESETS, FEE_STAGES, tickerFromName } from "../lib/sentia.ts";

test("every fee preset sums to 100%", () => {
  for (const p of FEE_PRESETS) {
    assert.equal(p.burn + p.fuel + p.creator + p.pad, 100, p.id);
  }
});

test("tickerFromName uppercases, strips and caps at 6", () => {
  assert.equal(tickerFromName("Mara Vox"), "MARAVO");
  assert.equal(tickerFromName("$delta-1"), "DELTA1");
  assert.equal(tickerFromName("!!!"), "AGENT");
  assert.equal(tickerFromName(""), "AGENT");
});

test("roster references known archetypes with unique tickers", () => {
  const tickers = new Set();
  for (const r of EXAMPLE_ROSTER) {
    assert.ok(ARCHETYPES[r.archetype], r.name);
    assert.ok(!tickers.has(r.ticker), r.ticker);
    tickers.add(r.ticker);
  }
});

test("fee stage copy renders for every archetype and preset, with no old brand", () => {
  for (const a of Object.values(ARCHETYPES)) {
    for (const p of FEE_PRESETS) {
      for (const st of FEE_STAGES) {
        const body = st.body(a, p);
        assert.ok(body.length > 20);
        assert.doesNotMatch(body, /agency|higgs|undefined/i);
      }
    }
  }
});
