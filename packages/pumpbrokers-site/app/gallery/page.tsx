"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrokerRow } from "../api/brokers/route";
import { BrokerCard, type Meta } from "../../components/BrokerCard";

type Enriched = BrokerRow & { meta: Meta | null };

/**
 * Gallery with trait filters.
 *
 * Metadata is fetched once per broker and the trait index is built from whatever comes
 * back, so the filter list is not hardcoded — add a trait to the generator and it shows
 * up here with no code change.
 */
export default function Gallery() {
  const [rows, setRows] = useState<Enriched[] | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/brokers", { cache: "no-store" });
      const { brokers } = (await r.json()) as { brokers: BrokerRow[] };
      const enriched = await Promise.all(
        brokers.map(async (b) => ({
          ...b,
          meta: await fetch(b.uri)
            .then((x) => (x.ok ? (x.json() as Promise<Meta>) : null))
            .catch(() => null),
        })),
      );
      if (!cancelled) setRows(enriched);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const traits = useMemo(() => {
    const index: Record<string, Set<string>> = {};
    for (const r of rows ?? []) {
      for (const a of r.meta?.attributes ?? []) {
        (index[a.trait_type] ??= new Set()).add(a.value);
      }
    }
    return Object.fromEntries(
      Object.entries(index).map(([k, v]) => [k, [...v].sort()]),
    );
  }, [rows]);

  const shown = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v);
    if (!rows) return [];
    if (active.length === 0) return rows;
    return rows.filter((r) =>
      active.every(([type, value]) =>
        r.meta?.attributes?.some((a) => a.trait_type === type && a.value === value),
      ),
    );
  }, [rows, filters]);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-widest">GALLERY</h1>
        <span className="tnum text-xs text-mute">
          {rows ? `${shown.length} shown` : "loading…"}
        </span>
      </header>

      {Object.keys(traits).length > 0 ? (
        <div className="panel space-y-3">
          {Object.entries(traits).map(([type, values]) => (
            <div key={type}>
              <div className="label mb-1">{type}</div>
              <div className="flex flex-wrap gap-1">
                {values.map((v) => {
                  const on = filters[type] === v;
                  return (
                    <button
                      key={v}
                      onClick={() =>
                        setFilters((f) => ({ ...f, [type]: on ? "" : v }))
                      }
                      className={`border-2 px-2 py-1 text-[10px] ${
                        on
                          ? "border-neon bg-neon text-ink"
                          : "border-edge text-mute hover:text-bone"
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {rows === null ? (
        <p className="panel text-sm text-mute">Reading the collection from chain…</p>
      ) : shown.length === 0 ? (
        <p className="panel text-sm text-mute">
          Nothing minted yet — the gallery fills in as brokers are claimed.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {shown.map((b) => (
            <BrokerCard key={b.address} broker={b} />
          ))}
        </div>
      )}
    </div>
  );
}
