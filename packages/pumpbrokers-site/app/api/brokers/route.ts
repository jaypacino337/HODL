import { NextResponse } from "next/server";
import { isLive } from "../../../../../config";
import { connection, decodeMintConfig } from "../../../lib/chain";
import { assetPda, configPda } from "../../../lib/pda";
import { decodeCoreAsset } from "../../../lib/coreAsset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type BrokerRow = {
  mintNumber: number;
  address: string;
  owner: string;
  name: string;
  uri: string;
};

const CHUNK = 100;

/**
 * Lists brokers, optionally filtered to one owner.
 *
 * Because asset addresses are PDAs of the mint number, the whole collection is 10
 * batched RPC calls and needs no indexer. That was the point of choosing PDA
 * addressing over client-generated keypairs.
 */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner");

  if (!isLive()) return NextResponse.json({ brokers: [] as BrokerRow[] });

  try {
    const conn = connection();
    const cfgAi = await conn.getAccountInfo(configPda());
    if (!cfgAi) return NextResponse.json({ brokers: [] as BrokerRow[] });
    const cfg = decodeMintConfig(cfgAi.data);

    const numbers = Array.from({ length: cfg.minted }, (_, i) => i);
    const rows: BrokerRow[] = [];

    for (let i = 0; i < numbers.length; i += CHUNK) {
      const slice = numbers.slice(i, i + CHUNK);
      const infos = await conn.getMultipleAccountsInfo(slice.map(assetPda));
      slice.forEach((n, j) => {
        const info = infos[j];
        if (!info) return;
        const asset = decodeCoreAsset(info.data);
        if (!asset) return;
        if (owner && asset.owner !== owner) return;
        rows.push({
          mintNumber: n,
          address: assetPda(n).toBase58(),
          owner: asset.owner,
          name: asset.name,
          uri: asset.uri,
        });
      });
    }

    return NextResponse.json(
      { brokers: rows },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } },
    );
  } catch {
    return NextResponse.json({ brokers: [] as BrokerRow[] });
  }
}
