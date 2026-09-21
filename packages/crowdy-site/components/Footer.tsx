import Link from "next/link";
import { CAMPAIGN_PROGRAM_ID, SITE, explorerAddr } from "../../../config/crowdy.ts";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-edge">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-muted">
        <p className="max-w-2xl leading-relaxed text-text">
          Crowdy never asks for a seed phrase and cannot move anything you own. You sign
          every transaction yourself, in your own wallet. Backed SOL sits in a vault the
          program controls — the person who posted the campaign cannot touch it unless
          the goal is met, and if it isn&apos;t met you can take yours back without
          asking anyone.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Link href="/" className="hover:text-text">
            Campaigns
          </Link>
          <Link href="/create" className="hover:text-text">
            Start one
          </Link>
          <Link href="/me" className="hover:text-text">
            Mine
          </Link>
          <a
            href={explorerAddr(CAMPAIGN_PROGRAM_ID)}
            target="_blank"
            rel="noreferrer"
            className="hover:text-text"
          >
            Program
          </a>
        </div>

        <p className="mt-4 text-xs">
          {SITE.name} — {SITE.tagline}
        </p>
      </div>
    </footer>
  );
}
