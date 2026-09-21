"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DURATION_PRESETS,
  FEE_BPS,
  GATE_AMOUNT,
  MAX_LINK,
  MAX_SUMMARY,
  MAX_TITLE,
  formatSol,
  sol,
} from "../../../../config/crowdy.ts";
import { useGateBalance, usePlatform, useTx } from "../../lib/hooks.ts";
import { createCampaignIx } from "../../lib/ix.ts";
import { TxStatus } from "../../components/TxStatus.tsx";
import { GateBadge } from "../../components/GateBadge.tsx";

export default function CreatePage() {
  const router = useRouter();
  const { platform } = usePlatform();
  const { balance, gateAccount } = useGateBalance();
  const { state, send, reset, publicKey } = useTx();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState<number>(DURATION_PRESETS[2].seconds);

  const eligible = balance !== null && balance >= GATE_AMOUNT;
  const goalLamports = useMemo(() => {
    const n = Number(goal);
    return Number.isFinite(n) && n > 0 ? sol(n) : 0n;
  }, [goal]);

  // Mirrors the program's own validation so people see the problem while typing
  // rather than after a failed simulation.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (!title.trim()) out.push("Give it a title.");
    if (title.length > MAX_TITLE) out.push(`Title is over ${MAX_TITLE} characters.`);
    if (summary.length > MAX_SUMMARY) out.push(`Summary is over ${MAX_SUMMARY} characters.`);
    if (link.length > MAX_LINK) out.push(`Link is over ${MAX_LINK} characters.`);
    if (goalLamports <= 0n) out.push("Set a goal above zero.");
    return out;
  }, [title, summary, link, goalLamports]);

  const canSubmit =
    publicKey && eligible && problems.length === 0 && !platform?.paused && platform?.deployed;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Start a campaign</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Say what you want to do and what it takes. If holders put up enough before the
          deadline, it&apos;s yours. If they don&apos;t, they all get their SOL back and
          you get nothing — that&apos;s the deal, and it&apos;s enforced by the program,
          not by trust.
        </p>
      </header>

      {!publicKey ? (
        <div className="card p-5 text-sm text-muted">Connect a wallet to post a campaign.</div>
      ) : !eligible ? (
        <GateBadge />
      ) : null}

      <TxStatus state={state} onReset={reset} />

      <div className="card space-y-5 p-6">
        <Field label="What's the idea?" hint={`${title.length}/${MAX_TITLE}`}>
          <input
            className="input"
            placeholder="Let's fund a billboard in Times Square"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Tell people why" hint={`${summary.length}/${MAX_SUMMARY}`}>
          <textarea
            className="input min-h-[96px] resize-y"
            placeholder="What it is, what the money goes to, and what happens when it's funded."
            value={summary}
            maxLength={MAX_SUMMARY}
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>

        <Field label="Link (optional)">
          <input
            className="input"
            placeholder="https://…"
            value={link}
            maxLength={MAX_LINK}
            onChange={(e) => setLink(e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Goal in SOL">
            <input
              className="input tnum"
              inputMode="decimal"
              placeholder="10"
              value={goal}
              onChange={(e) => setGoal(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>

          <Field label="Runs for">
            <select
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATION_PRESETS.map((d) => (
                <option key={d.seconds} value={d.seconds}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {goalLamports > 0n ? (
          <div className="rounded-xl border border-edge bg-bg p-4 text-xs leading-relaxed text-muted">
            If it funds, you receive{" "}
            <span className="tnum text-text">
              {formatSol((goalLamports * BigInt(10_000 - (platform?.feeBps ?? FEE_BPS))) / 10_000n)}{" "}
              SOL
            </span>{" "}
            at the goal, after the {((platform?.feeBps ?? FEE_BPS) / 100).toFixed(1)}%
            platform fee. If it misses, you receive nothing and every backer is refunded
            in full.
          </div>
        ) : null}

        {problems.length > 0 && (title || goal) ? (
          <ul className="space-y-1 text-xs text-warn">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}

        <button
          className="btn btn-primary w-full py-3"
          disabled={!canSubmit || state.kind === "simulating" || state.kind === "signing"}
          onClick={async () => {
            if (!publicKey || !gateAccount || !platform) return;
            const r = await send(() =>
              createCampaignIx({
                creator: publicKey,
                creatorGateAccount: gateAccount,
                // The next id is the current count — the program derives the PDA from
                // the same value and will reject a stale one.
                campaignId: platform.campaignCount,
                title: title.trim(),
                summary: summary.trim(),
                link: link.trim(),
                goalLamports,
                durationSeconds: duration,
              }),
            );
            if (r.ok) router.push(`/c/${platform.campaignCount}`);
          }}
        >
          {platform?.deployed ? "Post it" : "Not deployed yet"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label">{label}</span>
        {hint ? <span className="tnum text-[11px] text-muted">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}
