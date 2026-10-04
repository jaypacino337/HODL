"use client";

import { ARCHETYPES, FEE_PRESETS, tickerFromName, type Archetype, type FeeSplit } from "@/lib/sentia";

export interface LaunchState {
  archetype: Archetype;
  name: string;
  dial: number;
  preset: string;
  launched: boolean;
}

/**
 * The three-step launch, live on the page: pick the archetype, describe and
 * name the agent, pick where the fees go — the talent card and fee bar
 * re-render on every keystroke. "Launching" is an explicitly labeled demo.
 */
export function LaunchDemo({ s, set }: { s: LaunchState; set: (patch: Partial<LaunchState>) => void }) {
  const a = ARCHETYPES[s.archetype];
  const split = FEE_PRESETS.find((p) => p.id === s.preset) ?? FEE_PRESETS[0];
  const ticker = tickerFromName(s.name || (s.archetype === "influencer" ? "Mara Vox" : "Delta One"));
  const displayName = s.name || (s.archetype === "influencer" ? "Mara Vox" : "Delta One");

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr,1fr]" style={{ ["--arch" as string]: a.color }}>
      {/* the desk */}
      <div className="flex flex-col gap-4">
        {/* 01 archetype */}
        <div>
          <div className="eyebrow mb-2">01 · sign your talent</div>
          <div className="grid grid-cols-2 gap-3">
            {(Object.values(ARCHETYPES)).map((arch) => (
              <button
                key={arch.id}
                className="arch-card"
                data-active={s.archetype === arch.id}
                style={{ ["--arch" as string]: arch.color }}
                onClick={() => set({ archetype: arch.id, dial: 1, launched: false })}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em]" style={{ color: arch.color }}>
                  {arch.tag}
                </div>
                <div className="mt-1 font-sans text-lg font-extrabold">{arch.label}</div>
                <p className="mt-1.5 text-[0.76rem] leading-relaxed text-fog">{arch.blurb}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 02 identity */}
        <div>
          <div className="eyebrow mb-2">02 · one sentence &amp; a name</div>
          <div className="card flex flex-col gap-3 p-4">
            <input
              className="field"
              placeholder={s.archetype === "influencer" ? "e.g. Mara Vox — deadpan streetwear critic" : "e.g. Delta One — SOL majors momentum"}
              value={s.name}
              maxLength={28}
              onChange={(e) => set({ name: e.target.value, launched: false })}
            />
            <div>
              <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fog">{a.dialLabel}</div>
              <div className="dial">
                {a.dials.map((d, i) => (
                  <button key={d} data-active={s.dial === i} onClick={() => set({ dial: i, launched: false })}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 03 fees */}
        <div>
          <div className="eyebrow mb-2">03 · route the fees</div>
          <div className="card p-4">
            <div className="flex gap-2">
              {FEE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set({ preset: p.id, launched: false })}
                  className="flex-1 rounded-xl border px-3 py-2 font-mono text-[0.64rem] uppercase tracking-[0.12em] transition"
                  style={{
                    borderColor: s.preset === p.id ? a.color : "rgba(240,238,234,0.15)",
                    color: s.preset === p.id ? "#F0EEEA" : "#8E8D95",
                    background: s.preset === p.id ? "color-mix(in srgb, var(--arch) 12%, transparent)" : "transparent",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="split-bar mt-4">
              <div style={{ width: `${split.burn}%`, background: "#F2B705" }} title="burn $SENTIA" />
              <div style={{ width: `${split.fuel}%`, background: a.color }} title={a.fuelLabel} />
              <div style={{ width: `${split.creator}%`, background: "#F0EEEA" }} title="creator" />
              <div style={{ width: `${split.pad}%`, background: "#55545c" }} title="Sentia" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-fog sm:grid-cols-4">
              <span><b className="text-burn">{split.burn}%</b> burn $SENTIA</span>
              <span><b style={{ color: a.color }}>{split.fuel}%</b> {a.fuelLabel.split(" ")[0]}</span>
              <span><b className="text-chalk">{split.creator}%</b> creator</span>
              <span><b>{split.pad}%</b> the pad</span>
            </div>
          </div>
        </div>
      </div>

      {/* the talent card */}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">the talent card</div>
        <div className="talent-card">
          <div className="flex items-center gap-4">
            <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="truncate font-sans text-xl font-extrabold">{displayName}</div>
              <div className="font-mono text-[0.7rem] uppercase tracking-[0.16em]" style={{ color: a.color }}>
                ${ticker} · {a.label} · {a.dials[s.dial]}
              </div>
            </div>
          </div>
          <div className="rule-h my-4" />
          <div className="grid grid-cols-2 gap-y-2 font-mono text-[0.7rem]">
            <span className="text-fog">LAUNCH VENUE</span>
            <span className="text-right">pump.fun · its own token</span>
            <span className="text-fog">FEE ROUTE</span>
            <span className="text-right">{split.burn}/{split.fuel}/{split.creator}/{split.pad}</span>
            <span className="text-fog">{a.fuelLabel.toUpperCase()}</span>
            <span className="text-right">funded by every trade</span>
            <span className="text-fog">CUSTODY</span>
            <span className="text-right">agent wallet · hard risk caps</span>
          </div>
          <button
            className={`btn mt-5 w-full ${s.launched ? "btn-line" : "btn-sign"}`}
            onClick={() => set({ launched: !s.launched })}
          >
            {s.launched ? `✓ $${ticker} demo-launched` : `Launch $${ticker} (demo)`}
          </button>
          {s.launched && (
            <p className="mt-2.5 text-center font-mono text-[0.6rem] uppercase tracking-[0.14em] text-fog">
              demo only — nothing deployed, no token created
            </p>
          )}
        </div>
        <p className="text-[0.72rem] leading-relaxed text-fog">
          {a.id === "trader"
            ? "Traders run inside hard caps set at launch: bankroll ceiling, per-trade size, max drawdown kill-switch. Realized profits buy the agent's own token."
            : "Influencers are always AI-labeled. The persona, look and posting cadence are yours to direct from the dashboard; fuel pays for every render."}
        </p>
      </div>
    </div>
  );
}
