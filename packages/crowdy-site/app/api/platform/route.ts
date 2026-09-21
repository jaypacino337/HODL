import { NextResponse } from "next/server";
import {
  FEE_BPS,
  GATE_AMOUNT,
  GATE_MINT,
  isConfigured,
} from "../../../../../config/crowdy.ts";
import { connection, decodePlatform } from "../../../lib/chain.ts";
import { platformPda } from "../../../lib/pda.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type PlatformInfo = {
  deployed: boolean;
  configured: boolean;
  paused: boolean;
  gateMint: string | null;
  /** base units, as a decimal string — JSON has no BigInt */
  gateAmount: string;
  feeBps: number;
  feeDestination: string | null;
  campaignCount: number;
  authority: string | null;
};

/**
 * Returns a coherent, pre-deploy-safe shape when nothing is on chain yet, so the site
 * renders an honest "not live" state instead of an error page.
 */
export async function GET() {
  const offline: PlatformInfo = {
    deployed: false,
    configured: isConfigured(),
    paused: false,
    gateMint: GATE_MINT,
    gateAmount: GATE_AMOUNT.toString(),
    feeBps: FEE_BPS,
    feeDestination: null,
    campaignCount: 0,
    authority: null,
  };

  if (!isConfigured()) return NextResponse.json(offline);

  try {
    const ai = await connection().getAccountInfo(platformPda());
    if (!ai) return NextResponse.json(offline);
    const p = decodePlatform(ai.data);

    return NextResponse.json(
      {
        deployed: true,
        configured: true,
        paused: p.paused,
        gateMint: p.gateMint,
        gateAmount: p.gateAmount.toString(),
        feeBps: p.feeBps,
        feeDestination: p.feeDestination,
        campaignCount: p.campaignCount,
        authority: p.authority,
      } satisfies PlatformInfo,
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=20" } },
    );
  } catch {
    return NextResponse.json(offline);
  }
}
