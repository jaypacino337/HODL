"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { ActiveAd, bookAd, bookAdMessage, confirmAd, fetchAds } from "@/lib/api";
import { formatSol } from "@/lib/format";

type Booking = { bookingId: number; priceLamports: string; payTo: string; bookingCode: string };

export function AdsPanel() {
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const [pricePerDay, setPricePerDay] = useState<string>("0");
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [url, setUrl] = useState("");
  const [days, setDays] = useState(3);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [txSig, setTxSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const load = () =>
      fetchAds()
        .then((r) => {
          setAds(r.ads);
          setPricePerDay(r.priceLamportsPerDay);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  async function onBook() {
    if (!publicKey || !signMessage) {
      setVisible(true);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const wallet = publicKey.toBase58();
      const sig = await signMessage(new TextEncoder().encode(bookAdMessage(headline.trim(), days, wallet)));
      const res = await bookAd({
        wallet,
        headline: headline.trim(),
        url: url.trim(),
        days,
        signature: bs58.encode(sig),
      });
      if (res.ok && res.data) {
        setBooking(res.data);
        setMsg({ ok: true, text: `BOOKED ${res.data.bookingCode} — now send the payment below` });
      } else {
        setMsg({ ok: false, text: res.error ?? "rejected" });
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!booking) return;
    setBusy(true);
    setMsg(null);
    const res = await confirmAd({ bookingId: booking.bookingId, txSignature: txSig.trim() });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "PAYMENT VERIFIED — YOUR AD IS LIVE" });
      setBooking(null);
      setHeadline("");
      setUrl("");
      setTxSig("");
      fetchAds().then((r) => setAds(r.ads)).catch(() => {});
    } else {
      setMsg({ ok: false, text: res.error ?? "verification failed" });
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="fkey">F5</span>Adspace
        </div>
        <div className="label num">{formatSol(pricePerDay)} SOL / DAY · 90% → BUYBACKS</div>
      </div>

      <div className="p-3">
        {ads.length > 0 ? (
          ads.slice(0, 4).map((ad, i) => (
            <a
              key={i}
              href={ad.url}
              target="_blank"
              rel="noreferrer nofollow sponsored"
              className="mb-2 block border border-amber-dim/60 bg-term-bg px-3 py-2 hover:border-amber"
            >
              <span className="label text-amber">Sponsored</span>
              <div className="text-[13px] font-bold text-paper">{ad.headline}</div>
              <div className="truncate text-[10px] text-dim">{ad.url.replace(/^https?:\/\//, "")}</div>
            </a>
          ))
        ) : (
          <div className="mb-2 border border-dashed border-term-bright bg-term-bg px-3 py-4 text-center text-[11px] uppercase tracking-[0.14em] text-dim">
            This slot is for sale — your project, in front of the terminal.
          </div>
        )}

        {!open ? (
          <button className="tbtn w-full" onClick={() => setOpen(true)}>
            Book This Space
          </button>
        ) : (
          <div className="space-y-2">
            <input
              className="tinput"
              placeholder="HEADLINE (4-80 chars)"
              value={headline}
              maxLength={80}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <input className="tinput" placeholder="https://your-link" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex items-center gap-2">
              <span className="label shrink-0">Days</span>
              <input
                className="tinput w-20"
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              />
              <span className="num text-[12px] text-amber-hi">
                = {formatSol(BigInt(pricePerDay) * BigInt(days))} SOL
              </span>
              <button
                className="tbtn tbtn-solid ml-auto"
                disabled={busy || headline.trim().length < 4 || !url.trim()}
                onClick={onBook}
              >
                {busy ? "…" : "Sign & Book"}
              </button>
            </div>

            {booking && (
              <div className="border border-amber-dim bg-term-bg p-2 text-[11px]">
                <div className="label mb-1">Step 2 — pay & confirm</div>
                <div>
                  Send <span className="num font-bold text-amber-hi">{formatSol(booking.priceLamports)} SOL</span> to
                </div>
                <div className="num break-all text-cyan">{booking.payTo}</div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="tinput"
                    placeholder="paste payment tx signature"
                    value={txSig}
                    onChange={(e) => setTxSig(e.target.value)}
                  />
                  <button className="tbtn shrink-0" disabled={busy || !txSig.trim()} onClick={onConfirm}>
                    Verify
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {msg && (
          <div className={`mt-2 text-[11px] font-bold uppercase tracking-[0.08em] ${msg.ok ? "pos" : "neg"}`}>
            {msg.text}
          </div>
        )}
      </div>
    </section>
  );
}
