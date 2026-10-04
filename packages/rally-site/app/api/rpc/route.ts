import { NextResponse } from "next/server";
import { rpcUrl } from "../../../lib/chain.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Narrow server-side RPC proxy. The Helius key never reaches the browser.
 *
 * The allowlist matters: without it this is an open relay, and anyone's bot could
 * burn the free-tier quota and take the site down at exactly the wrong moment.
 */
const ALLOWED = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getLatestBlockhash",
  "getSignatureStatuses",
  "getMinimumBalanceForRentExemption",
  "simulateTransaction",
  "sendTransaction",
  "getTransaction",
  "getSlot",
]);

const MAX_BODY = 100_000;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const c of Array.isArray(body) ? body : [body]) {
    const m = (c as { method?: unknown })?.method;
    if (typeof m !== "string" || !ALLOWED.has(m)) {
      return NextResponse.json({ error: `Method not allowed: ${String(m)}` }, { status: 403 });
    }
  }

  const upstream = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
    cache: "no-store",
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
