import Link from "next/link";
import { MINT_PROGRAM_ID, BUYBACK_PROGRAM_ID } from "../../../config";

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-edge">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 text-xs text-mute">
        {/* Said plainly, because it is the single most important thing on the site.
            Borrowed in spirit from pumpbroker.fun, whose version of this is the
            clearest on-chain safety copy going. */}
        <p className="mb-4 max-w-2xl leading-relaxed text-bone">
          This site never asks for a seed phrase and cannot move anything you own. You
          sign every transaction yourself, in your own wallet, and you can read exactly
          what each one does before you approve it.
        </p>

        <div className="rule mb-4" />

        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="label">Mint program</dt>
            <dd className="break-all">{MINT_PROGRAM_ID}</dd>
          </div>
          <div>
            <dt className="label">Buyback program</dt>
            <dd className="break-all">{BUYBACK_PROGRAM_ID}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link href="/admin" className="hover:text-bone">
            ADMIN
          </Link>
          <span>1,000 pixel brokers. No roadmap.</span>
        </div>
      </div>
    </footer>
  );
}
