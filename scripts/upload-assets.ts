/**
 * P1 — upload art and metadata to Arweave via Irys.
 *
 *   node scripts/price-upload.ts --art ./art --metadata ./metadata    # ALWAYS FIRST
 *   node scripts/upload-assets.ts --art ./art --metadata ./metadata --keypair ...
 *
 * Resumable: every uploaded file is recorded in upload-manifest.json as it lands, so a
 * dropped connection halfway through 1,000 files costs you the remainder, not the lot.
 * Re-running skips what is already up.
 *
 * Uploads images first, then rewrites each metadata JSON's `image` field to the real
 * Arweave URI before uploading it — metadata that points at a local path is the
 * classic way to ship a collection where every image is broken.
 *
 * Writes METADATA_BASE_URI to .env on success.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { arg, costGate, die, keypairArg, requireBalance, umi, writeEnv } from "./lib.ts";

const MANIFEST = "upload-manifest.json";
const MIB = 1024 * 1024;

type Manifest = { images: Record<string, string>; metadata: Record<string, string> };

function load(): Manifest {
  return existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest)
    : { images: {}, metadata: {} };
}

async function main() {
  const artDir = arg("art") ?? "./art";
  const metaDir = arg("metadata") ?? "./metadata";

  const list = (dir: string, ext: string): string[] => {
    if (!existsSync(dir)) {
      die(`Cannot read ${dir}. Pass --art / --metadata pointing at the real folders.`);
    }
    return readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ext)).sort();
  };

  const images = list(artDir, ".png");
  const metas = list(metaDir, ".json");
  if (images.length === 0) die(`No PNGs in ${artDir}. Run price-upload.ts first.`);

  const manifest = load();
  const pendingImages = images.filter((f) => !manifest.images[f]);
  const pendingMeta = metas.filter((f) => !manifest.metadata[f]);

  const bytes = pendingImages.reduce(
    (a, f) => a + readFileSync(join(artDir, f)).byteLength,
    0,
  );

  console.log(`\n  images:   ${pendingImages.length} of ${images.length} still to upload`);
  console.log(`  metadata: ${pendingMeta.length} of ${metas.length} still to upload`);
  console.log(`  bytes:    ${(bytes / MIB).toFixed(2)} MiB\n`);

  if (pendingImages.length === 0 && pendingMeta.length === 0) {
    console.log("  Everything already uploaded.\n");
    return;
  }

  await costGate([
    {
      step: `Arweave upload (${(bytes / MIB).toFixed(2)} MiB)`,
      sol: (bytes / MIB) * 0.0075,
      wallet: "authority",
      recoverable: false,
      seconds: Math.ceil(bytes / MIB) * 4,
    },
  ]);

  const u = await umi(keypairArg());
  const { PublicKey } = await import("@solana/web3.js");
  await requireBalance(new PublicKey(String(u.identity.publicKey)), (bytes / MIB) * 0.0075 + 0.05);

  const { createGenericFile } = await import("./umi-imports.ts");
  const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  // ---- images ----
  for (const [i, file] of pendingImages.entries()) {
    const data = readFileSync(join(artDir, file));
    const [uri] = await u.uploader.upload([
      createGenericFile(new Uint8Array(data), file, { contentType: "image/png" }),
    ]);
    manifest.images[file] = uri;
    save();
    if (i % 25 === 0 || i === pendingImages.length - 1) {
      console.log(`  images ${i + 1}/${pendingImages.length}`);
    }
  }

  // ---- metadata, with image URIs rewritten ----
  for (const [i, file] of pendingMeta.entries()) {
    const json = JSON.parse(readFileSync(join(metaDir, file), "utf8")) as {
      image?: string;
      properties?: { files?: { uri: string; type?: string }[] };
    };

    // Point at the uploaded image, not at whatever local path the generator wrote.
    const imageName = basename(json.image ?? `${file.replace(/\.json$/, "")}.png`);
    const uploaded = manifest.images[imageName];
    if (!uploaded) die(`${file} references "${imageName}", which was not uploaded.`);
    json.image = uploaded;
    if (json.properties?.files?.length) {
      json.properties.files = json.properties.files.map((f) => ({ ...f, uri: uploaded }));
    }

    const [uri] = await u.uploader.upload([
      createGenericFile(
        new TextEncoder().encode(JSON.stringify(json)),
        file,
        { contentType: "application/json" },
      ),
    ]);
    manifest.metadata[file] = uri;
    save();
    if (i % 25 === 0 || i === pendingMeta.length - 1) {
      console.log(`  metadata ${i + 1}/${pendingMeta.length}`);
    }
  }

  console.log(`\n  ✓ Upload complete. Manifest: ${MANIFEST}\n`);
  console.log("  IMPORTANT: Irys gives each file its own URI, so there is no shared");
  console.log("  base path. Set METADATA_BASE_URI only if you uploaded as a folder");
  console.log("  manifest; otherwise the program's ${base}${index}.json scheme needs");
  console.log("  a gateway path. Check one URI in the manifest and set .env to match:\n");
  console.log(`    example: ${Object.values(manifest.metadata)[0] ?? "(none)"}\n`);

  const sample = Object.values(manifest.metadata)[0];
  if (sample) {
    const base = sample.replace(/[^/]+$/, "");
    console.log(`  Suggested NEXT_PUBLIC_METADATA_BASE_URI: ${base}`);
    if (process.argv.includes("--write-env")) writeEnv("NEXT_PUBLIC_METADATA_BASE_URI", base);
    else console.log("  (pass --write-env to write it automatically)\n");
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
