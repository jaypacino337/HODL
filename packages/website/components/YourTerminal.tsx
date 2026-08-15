"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { fetchPlayer, Player, submitPost, submitPostMessage } from "@/lib/api";
import { formatPoints, shortAddress } from "@/lib/format";

const STATUS_COLOR: Record<string, string> = {
  approved: "pos",
  pending: "text-amber",
  denied: "neg",
};

export function YourTerminal({ ticker }: { ticker: string }) {
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [player, setPlayer] = useState<Player | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    if (!publicKey) {
      setPlayer(null);
      return;
    }
    fetchPlayer(publicKey.toBase58()).then(setPlayer).catch(() => {});
  }, [publicKey]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function onSubmit() {
    if (!publicKey || !signMessage) {
      setVisible(true);
      return;
    }
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setMsg(null);
    try {
      const wallet = publicKey.toBase58();
      const sig = await signMessage(new TextEncoder().encode(submitPostMessage(trimmed, wallet)));
      const res = await submitPost({ wallet, url: trimmed, signature: bs58.encode(sig) });
      if (res.ok) {
        setMsg({ ok: true, text: `LOGGED — ${res.data?.note ?? "queued for review"}` });
        setUrl("");
        refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "rejected" });
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message ?? "signing cancelled" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="fkey">F4</span>Your Terminal
        </div>
        {publicKey && <div className="label num">{shortAddress(publicKey.toBase58(), 5)}</div>}
      </div>

      {!connected ? (
        <div className="p-4 text-[12px] text-dim">
          <button onClick={() => setVisible(true)} className="tbtn tbtn-solid mb-2">
            Connect Wallet
          </button>
          <div>
            Connect to open your operator profile: attention points, tier, rank, and airdrop
            eligibility tracking.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 p-3">
            <div className="border border-term-border bg-term-bg px-3 py-2">
              <div className="label">Attention points</div>
              <div className="num text-[17px] font-bold text-amber-hi">
                {player ? formatPoints(player.lifetimePoints) : "…"}
              </div>
            </div>
            <div className="border border-term-border bg-term-bg px-3 py-2">
              <div className="label">This epoch</div>
              <div className="num text-[17px] font-bold text-cyan">
                {player ? formatPoints(player.epochPoints) : "…"}
              </div>
            </div>
            <div className="border border-term-border bg-term-bg px-3 py-2">
              <div className="label">Tier</div>
              <div className="text-[14px] font-bold text-amber">{player?.tier ?? "…"}</div>
            </div>
            <div className="border border-term-border bg-term-bg px-3 py-2">
              <div className="label">Rank</div>
              <div className="num text-[17px] font-bold text-paper">
                {player?.rank ? `#${player.rank}` : "—"}
              </div>
            </div>
          </div>

          <div className="border-t border-term-border p-3">
            <div className="label mb-1.5">
              Post about {ticker} on X → drop the link → earn points → climb toward the airdrop
            </div>
            <div className="flex gap-2">
              <input
                className="tinput"
                placeholder="https://x.com/you/status/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && onSubmit()}
              />
              <button className="tbtn tbtn-solid shrink-0" disabled={busy || !url.trim()} onClick={onSubmit}>
                {busy ? "…" : "Log It"}
              </button>
            </div>
            {msg && (
              <div className={`mt-2 text-[11px] font-bold uppercase tracking-[0.08em] ${msg.ok ? "pos" : "neg"}`}>
                {msg.text}
              </div>
            )}
            <div className="mt-1.5 text-[10px] text-dim">
              Signed message, no gas. Points are eligibility signal for a potential airdrop — tracked
              transparently, never guaranteed.
            </div>
          </div>

          {player && player.posts.length > 0 && (
            <div className="max-h-[150px] overflow-y-auto border-t border-term-border px-3 py-2">
              {player.posts.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-[11px]">
                  <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-paper/80 hover:text-amber-hi">
                    {p.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                  <span className={`shrink-0 font-bold uppercase ${STATUS_COLOR[p.status]}`}>
                    {p.status === "approved" ? `+${p.points}` : p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
