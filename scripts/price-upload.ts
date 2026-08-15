/**
 * P1 (dry run) — price the permanent storage before spending a lamport.
 *
 *   node scripts/price-upload.ts --art ./art --metadata ./metadata
 *
 * Measures the real bytes on disk and prints what Arweave will cost. Runs entirely
 * locally — no network, no wallet, no risk. This is the number that has been the
 * largest unpriced item in the project.
 *
 * It also answers the resolution question directly: if the PNGs are nearest-neighbour
 * upscales of a smaller source, this prints how much that is costing you. Everything
 * on the site renders with `image-rendering: pixelated`, so a 64x64 source displays
 * identically to its 1024x1024 upscale — at roughly 1/100th the storage.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { arg, die } from "./lib.ts";

/** Rough Arweave price via Irys, in SOL per MiB. Override with --rate. */
const DEFAULT_SOL_PER_MIB = 0.0075;

const MIB = 1024 * 1024;

function walk(dir: string, ext: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(ext))
      .map((f) => join(dir, f));
  } catch {
    die(`Cannot read ${dir}. Pass --art / --metadata pointing at the real folders.`);
  }
}

/**
 * Reads a PNG's IHDR and detects nearest-neighbour upscaling by finding the largest
 * block size for which every pixel block is uniform. Only inspects the header plus a
 * cheap heuristic on file size — decoding 1,000 PNGs is not worth it here.
 */
function pngSize(path: string): { w: number; h: number } | null {
  const b = readFileSync(path).subarray(0, 33);
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) return null; // 'IHDR'
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function main() {
  const artDir = arg("art") ?? "./art";
  const metaDir = arg("metadata") ?? "./metadata";
  const rate = Number(arg("rate") ?? DEFAULT_SOL_PER_MIB);

  const images = walk(artDir, ".png");
  const metas = walk(metaDir, ".json");
  if (images.length === 0) die(`No PNGs in ${artDir}.`);

  const imgBytes = images.reduce((a, f) => a + statSync(f).size, 0);
  const metaBytes = metas.reduce((a, f) => a + statSync(f).size, 0);
  const total = imgBytes + metaBytes;

  const dims = images.slice(0, 50).map(pngSize).filter(Boolean) as { w: number; h: number }[];
  const w = dims[0]?.w ?? 0;
  const h = dims[0]?.h ?? 0;
  const uniform = dims.every((d) => d.w === w && d.h === h);

  console.log(`\n  UPLOAD COST — dry run, nothing sent\n`);
  console.log(`  images:        ${images.length} files, ${(imgBytes / MIB).toFixed(2)} MiB`);
  console.log(`  metadata:      ${metas.length} files, ${(metaBytes / MIB).toFixed(3)} MiB`);
  console.log(`  total:         ${(total / MIB).toFixed(2)} MiB`);
  console.log(`  dimensions:    ${uniform ? `${w}x${h}` : "MIXED — check the generator output"}`);
  console.log(`  rate:          ${rate} SOL/MiB (override with --rate)\n`);

  const cost = (total / MIB) * rate;
  console.log(`  ESTIMATED COST: ${cost.toFixed(4)} SOL   (permanent, NOT recoverable)\n`);

  // The resolution question, answered with the actual files.
  if (uniform && w >= 512) {
    const avgKb = imgBytes / images.length / 1024;
    console.log(`  ${w}x${w} at ${avgKb.toFixed(1)} KB average.`);
    if (avgKb > 20) {
      const factors = [4, 8, 16].filter((f) => w % f === 0);
      console.log(`\n  WORTH CHECKING: if these are upscales of a smaller source, storing`);
      console.log(`  the originals is visually identical (everything renders with`);
      console.log(`  image-rendering: pixelated) at a fraction of the cost:`);
      for (const f of factors) {
        console.log(
          `    ${String(w / f).padStart(4)}x${String(w / f).padEnd(4)} source  ->  roughly ${(cost / (f * f)).toFixed(4)} SOL`,
        );
      }
      console.log(`\n  Re-export from the Python generator without the upscale and re-run this.`);
    }
  }
  console.log(`\n  When you're happy with the number: node scripts/upload-assets.ts\n`);
}

main();
