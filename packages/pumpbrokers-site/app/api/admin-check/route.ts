import { NextResponse } from "next/server";
import { isLive } from "../../../../../config";
import { connection, decodeMintConfig } from "../../../lib/chain";
import { configPda } from "../../../lib/pda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the on-chain mint authority so the admin page can hide controls from
 * everyone else.
 *
 * This is presentation only. The authority is public on chain anyway, and the
 * enforcement that matters is the `address = config.authority` constraint inside the
 * program — nothing here grants anything.
 */
export async function GET() {
  if (!isLive()) return NextResponse.json({ authority: null });
  try {
    const ai = await connection().getAccountInfo(configPda());
    if (!ai) return NextResponse.json({ authority: null });
    const cfg = decodeMintConfig(ai.data);
    return NextResponse.json({ authority: cfg.authority, redeemer: cfg.redeemer });
  } catch {
    return NextResponse.json({ authority: null });
  }
}
