"use client";

import { useState } from "react";
import { API_URL, MODE, useBoardState } from "@/lib/data";

/**
 * Operational controls. Everything here requires the engine ADMIN_KEY — the
 * key is entered locally, sent only as a request header to the engine, and
 * never stored. Without a connected engine this page is inert.
 */
export default function AdminPage() {
  const { launchState, policy } = useBoardState();
  const [key, setKey] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const call = async (path: string, body?: unknown) => {
    if (MODE !== "api") return setLog((l) => [`no engine connected (mode: ${MODE})`, ...l]);
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": key },
        body: body ? JSON.stringify(body) : "{}",
      });
      const j = await res.json().catch(() => ({}));
      setLog((l) => [`${path} → ${res.status} ${JSON.stringify(j).slice(0, 140)}`, ...l].slice(0, 12));
    } catch (e) {
      setLog((l) => [`${path} → network error`, ...l]);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="eyebrow">Operations</div>
      <h1 className="display text-3xl text-cream">Admin</h1>
      <p className="mt-2 text-sm text-cream-dim">
        Engine state: <span className="text-brass-300">{launchState}</span> · policy {policy.version}. All actions are
        authorized by the engine's admin key and land on the audit log.
      </p>

      <div className="panel mt-6 p-5">
        <label className="eyebrow mb-2 block">Admin key</label>
        <input className="field" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="x-admin-key" />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-brass" disabled={!key} onClick={() => void call("/api/admin/session/start")}>
            Convene session
          </button>
          <button className="btn btn-ghost" disabled={!key} onClick={() => void call("/api/admin/pause", { paused: true })}>
            Emergency pause
          </button>
          <button className="btn btn-ghost" disabled={!key} onClick={() => void call("/api/admin/pause", { paused: false })}>
            Resume
          </button>
        </div>
        <div className="mt-4">
          <label className="eyebrow mb-2 block">Policy patch (JSON)</label>
          <PolicyPatch onSubmit={(patch) => void call("/api/admin/policy", { patch })} disabled={!key} />
        </div>
      </div>

      <div className="panel mt-4 p-4">
        <div className="eyebrow mb-2">Result log</div>
        {log.length === 0 ? (
          <p className="font-mono text-[0.7rem] text-cream-faint">no calls yet</p>
        ) : (
          log.map((l, i) => (
            <p key={i} className="break-all font-mono text-[0.68rem] text-cream-dim">
              {l}
            </p>
          ))
        )}
      </div>
    </main>
  );
}

function PolicyPatch({ onSubmit, disabled }: { onSubmit: (patch: unknown) => void; disabled: boolean }) {
  const [raw, setRaw] = useState('{"maxPerSessionUsd": 20000}');
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <textarea className="field h-20 font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} />
      {err && <p className="mt-1 font-mono text-[0.68rem] text-reject">{err}</p>}
      <button
        className="btn btn-ghost mt-2"
        disabled={disabled}
        onClick={() => {
          try {
            onSubmit(JSON.parse(raw));
            setErr(null);
          } catch {
            setErr("invalid JSON");
          }
        }}
      >
        Apply patch
      </button>
    </div>
  );
}
