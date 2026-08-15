import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  BUYBACK_PAYOUT,
  MINT_PRICE,
  TOTAL_SUPPLY,
  isLive,
} from "../../../../../config";
import {
  connection,
  decodeBuybackConfig,
  decodeMintConfig,
  decodeVaultQueue,
} from "../../../lib/chain";
import { buybackConfigPda, configPda, vaultPda } from "../../../lib/pda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export type Stats = {
  live: boolean;
  minted: number;
  totalSupply: number;
  honoraryCount: number;
  isActive: boolean;
  /** base units, as decimal strings — JSON has no BigInt */
  price: string;
  treasury: string;
  payout: string;
  redemptionsAvailable: number;
  buybackLive: boolean;
  redeemed: number;
  vaultQueue: number[];
  treasuryAddress: string | null;
};

/**
 * One round trip for everything the landing page shows. Returns a coherent,
 * pre-launch-safe shape when nothing is deployed yet, so the site renders instead of
 * erroring before there is a chain to read.
 */
export async function GET() {
  const offline: Stats = {
    live: false,
    minted: 0,
    totalSupply: TOTAL_SUPPLY,
    honoraryCount: 10,
    isActive: false,
    price: MINT_PRICE.toString(),
    treasury: "0",
    payout: BUYBACK_PAYOUT.toString(),
    redemptionsAvailable: 0,
    buybackLive: false,
    redeemed: 0,
    vaultQueue: [],
    treasuryAddress: null,
  };

  if (!isLive()) return NextResponse.json(offline);

  try {
    const conn = connection();
    const [cfgAi, vaultAi, buybackAi] = await conn.getMultipleAccountsInfo([
      configPda(),
      vaultPda(),
      buybackConfigPda(),
    ]);

    if (!cfgAi) return NextResponse.json(offline);
    const cfg = decodeMintConfig(cfgAi.data);

    let treasury = 0n;
    try {
      const bal = await conn.getTokenAccountBalance(new PublicKey(cfg.treasury));
      treasury = BigInt(bal.value.amount);
    } catch {
      // Treasury not created yet — 0 is the honest answer, not an error page.
    }

    const buyback = buybackAi ? decodeBuybackConfig(buybackAi.data) : null;
    const payout = buyback?.payoutAmount ?? BUYBACK_PAYOUT;

    // Integer division. A redemption is only "available" if the treasury can cover
    // it in full — no partial payouts, no rounding.
    const available = payout > 0n ? Number(treasury / payout) : 0;

    const stats: Stats = {
      live: true,
      minted: cfg.minted + cfg.honoraryCount,
      totalSupply: cfg.totalSupply,
      honoraryCount: cfg.honoraryCount,
      isActive: cfg.isActive,
      price: cfg.price.toString(),
      treasury: treasury.toString(),
      payout: payout.toString(),
      redemptionsAvailable: available,
      // Both switches must be on: the buyback program active AND the mint program
      // pointing at it. Either one off means no redemptions.
      buybackLive: Boolean(buyback?.isActive && cfg.redeemer),
      redeemed: buyback?.redeemed ?? 0,
      vaultQueue: vaultAi ? decodeVaultQueue(vaultAi.data) : [],
      treasuryAddress: cfg.treasury,
    };

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=20" },
    });
  } catch {
    return NextResponse.json(offline);
  }
}
