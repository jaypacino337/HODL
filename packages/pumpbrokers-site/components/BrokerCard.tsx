"use client";

import { useEffect, useState } from "react";
import type { BrokerRow } from "../app/api/brokers/route";

export type Meta = {
  name?: string;
  image?: string;
  attributes?: { trait_type: string; value: string }[];
};

/**
 * Every broker image renders with image-rendering: pixelated, at every size. If one
 * ever looks smoothed, this component is the bug.
 */
export function BrokerImage({
  src,
  alt,
  className = "",
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex aspect-square w-full items-center justify-center border-2 border-edge bg-slab text-[10px] text-mute ${className}`}
      >
        UNREVEALED
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`pixel aspect-square w-full border-2 border-edge bg-slab object-cover ${className}`}
    />
  );
}

export function useMetadata(uri?: string) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    fetch(uri)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setMeta(j))
      .catch(() => !cancelled && setMeta(null));
    return () => {
      cancelled = true;
    };
  }, [uri]);
  return meta;
}

export function BrokerCard({
  broker,
  footer,
}: {
  broker: BrokerRow;
  footer?: React.ReactNode;
}) {
  const meta = useMetadata(broker.uri);
  const airdrop = meta?.attributes?.find((a) => a.trait_type === "Airdrop")?.value;

  return (
    <div className="panel p-2">
      <BrokerImage src={meta?.image} alt={broker.name} />
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xs font-bold">{meta?.name ?? broker.name}</span>
        {airdrop ? (
          <span className="border border-neon px-1 text-[9px] text-neon">{airdrop}</span>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
