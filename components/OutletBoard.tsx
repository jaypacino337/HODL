"use client";

import { useState } from "react";
import { PLUGS, PLUG_BY_ID, SCENARIOS, type PlugId } from "@/lib/plugs";

/**
 * The hero widget: drag a plug into the outlet (or tap its name) and the
 * example pool card re-wires itself. Keyboard: focus a chip and press Enter.
 */
export function OutletBoard({ plug, onSelect }: { plug: PlugId; onSelect: (p: PlugId) => void }) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState<PlugId | null>(null);
  const active = plug !== "empty" ? PLUG_BY_ID[plug] : null;
  const scenario = SCENARIOS[plug];

  const ALL_PHASES = ["before swap", "after swap", "before add", "after add", "before remove", "after remove"] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr,1fr]">
      {/* the wall */}
      <div className="program relative p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-dark-mute">The wall</span>
          <span className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-dark-mute">
            <span className="lamp" data-on={plug !== "empty"} />
            {plug === "empty" ? "no load" : "live"}
          </span>
        </div>

        {/* faceplate */}
        <div
          className="socket-face mx-auto mt-6 w-[200px] rounded-2xl border border-dark-line bg-[#262623] p-5 transition"
          data-hint={plug === "empty" && !over}
          data-over={over}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const id = e.dataTransfer.getData("text/plug") as PlugId;
            if (id) onSelect(id);
          }}
        >
          <div className="mx-auto w-[150px] rounded-xl bg-[#EDEAE1] px-4 py-6 shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]">
            {/* NEMA slots */}
            <div className="flex items-start justify-center gap-9">
              <div className="h-9 w-[9px] rounded-sm bg-ink transition-all" style={{ background: active ? active.color : "#151514" }} />
              <div className="h-7 w-[9px] rounded-sm bg-ink" />
            </div>
            <div className="mx-auto mt-4 h-4 w-4 rounded-t-full rounded-b-md bg-ink/80" />
            <div className="mt-5 text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink/60">
              {active ? active.name : "empty outlet"}
            </div>
          </div>
        </div>

        {/* cord to plugged appliance */}
        <svg viewBox="0 0 320 48" className="mx-auto mt-1 block w-[320px] max-w-full" aria-hidden>
          <path
            d="M160 2 C 160 26, 160 26, 160 46"
            fill="none"
            stroke={active ? active.color : "rgba(247,245,239,0.14)"}
            strokeWidth="3"
            className={active ? "wire" : ""}
          />
        </svg>

        {/* plugs on the floor */}
        <p className="mb-3 text-center font-mono text-[0.64rem] uppercase tracking-[0.16em] text-dark-mute">
          drag an appliance into the outlet · or tap it
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {PLUGS.map((p) => (
            <button
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plug", p.id);
                setDragging(p.id);
              }}
              onDragEnd={() => setDragging(null)}
              onClick={() => onSelect(plug === p.id ? "empty" : p.id)}
              className="plug-chip !bg-[#1E1E1C] !text-[#B9B8B1]"
              style={{ ["--plug" as string]: p.color, borderColor: plug === p.id ? p.color : "rgba(247,245,239,0.2)" }}
              data-active={plug === p.id}
              data-dragging={dragging === p.id}
              aria-pressed={plug === p.id}
            >
              <span className="plug-dot" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
          {plug !== "empty" && (
            <button onClick={() => onSelect("empty")} className="plug-chip !border-dark-line !bg-transparent !text-dark-mute">
              unplug
            </button>
          )}
        </div>
      </div>

      {/* the pool card */}
      <div className="card flex flex-col p-6 sm:p-7">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-mute">SOL/USD · example pool</span>
          <span className="font-mono text-[0.8rem] text-ink">
            fee <b className="tick">{scenario.feeLabel}</b>
          </span>
        </div>
        <h3 className="mt-3 font-sans text-xl font-bold leading-snug">
          {active ? active.name : "Empty outlet"}
        </h3>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-mute">
          {active ? active.blurb : "No appliance. The pool runs as a plain concentrated-liquidity pool with a 0.30% fee."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {ALL_PHASES.map((ph) => {
            const on = active?.phases.includes(ph) ?? false;
            return (
              <div
                key={ph}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition"
                style={{
                  borderColor: on ? active!.color : "rgba(21,21,20,0.12)",
                  color: on ? "#151514" : "#9a9992",
                  background: on ? "rgba(21,21,20,0.03)" : "transparent",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? active!.color : "#c9c8c0" }} />
                {ph}
              </div>
            );
          })}
        </div>

        <div className="rule-h my-5" />
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mute">
          <span>{scenario.feeNote}</span>
          <span>{active ? active.permissions.join(" · ") : "nothing to permit"}</span>
        </div>
      </div>
    </div>
  );
}
