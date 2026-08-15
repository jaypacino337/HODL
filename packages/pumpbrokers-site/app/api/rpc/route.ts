import { NextResponse } from "next/server";
import { rpcUrl } from "../../../lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side RPC proxy. The browser talks to this route; this route talks to Helius.
 * The API key never reaches the client.
 *
 * It is a *narrow* proxy, not an open relay: only the read methods the site actually
 * uses are forwarded. Without this allowlist, anyone could point their own bot at our
 * endpoint and burn the free-tier quota, which would take the site down on launch day.
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
  "getProgramAccounts",
  "simulateTransaction",
  "sendTransaction",
  "getTransaction",
  "getSlot",
]);

const MAX_BODY_BYTES = 100_000;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const calls = Array.isArray(body) ? body : [body];
  for (const c of calls) {
    const method = (c as { method?: unknown })?.method;
    if (typeof method !== "string" || !ALLOWED.has(method)) {
      return NextResponse.json(
        { error: `Method not allowed: ${String(method)}` },
        { status: 403 },
      );
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
