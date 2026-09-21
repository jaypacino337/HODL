import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { isConfigured } from "../../../../../config/crowdy.ts";
import {
  connection,
  decodeCampaign,
  decodeContribution,
  decodePlatform,
  type Status,
} from "../../../lib/chain.ts";
import { campaignPda, contributionPda, platformPda } from "../../../lib/pda.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CampaignRow = {
  id: number;
  address: string;
  creator: string;
  title: string;
  summary: string;
  link: string;
  /** lamports as decimal strings — JSON has no BigInt */
  goal: string;
  raised: string;
  backerCount: number;
  createdAt: number;
  deadline: number;
  status: Status;
  /** present only when ?backer= was supplied */
  yourContribution?: { amount: string; refunded: boolean } | null;
};

const CHUNK = 100;

/**
 * Lists campaigns. Optionally annotates each with the caller's own position.
 *
 * Campaign addresses are PDAs of a sequential id, so this derives 0..count and batches
 * — no indexer, no getProgramAccounts scan that a public RPC would rate-limit.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const backerParam = url.searchParams.get("backer");
  const idParam = url.searchParams.get("id");

  if (!isConfigured()) return NextResponse.json({ campaigns: [] as CampaignRow[] });

  try {
    const conn = connection();
    const platformAi = await conn.getAccountInfo(platformPda());
    if (!platformAi) return NextResponse.json({ campaigns: [] as CampaignRow[] });
    const platform = decodePlatform(platformAi.data);

    const ids =
      idParam !== null
        ? [Number(idParam)]
        : Array.from({ length: platform.campaignCount }, (_, i) => i);

    const rows: CampaignRow[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const infos = await conn.getMultipleAccountsInfo(slice.map((n) => campaignPda(n)));
      slice.forEach((n, j) => {
        const info = infos[j];
        if (!info) return;
        const addr = campaignPda(n).toBase58();
        const c = decodeCampaign(info.data, addr);
        rows.push({
          id: c.id,
          address: addr,
          creator: c.creator,
          title: c.title,
          summary: c.summary,
          link: c.link,
          goal: c.goal.toString(),
          raised: c.raised.toString(),
          backerCount: c.backerCount,
          createdAt: c.createdAt,
          deadline: c.deadline,
          status: c.status,
        });
      });
    }

    // Annotate with the caller's own position, so "my backed campaigns" and the
    // refund button need no second round trip.
    if (backerParam) {
      try {
        const backer = new PublicKey(backerParam);
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const infos = await conn.getMultipleAccountsInfo(
            slice.map((r) => contributionPda(new PublicKey(r.address), backer)),
          );
          slice.forEach((r, j) => {
            const info = infos[j];
            if (!info) {
              r.yourContribution = null;
              return;
            }
            const c = decodeContribution(info.data);
            r.yourContribution = { amount: c.amount.toString(), refunded: c.refunded };
          });
        }
      } catch {
        // A malformed ?backer= must not take the whole listing down.
      }
    }

    rows.sort((a, b) => b.id - a.id); // newest first
    return NextResponse.json(
      { campaigns: rows },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=20" } },
    );
  } catch {
    return NextResponse.json({ campaigns: [] as CampaignRow[] });
  }
}
