/**
 * The one place the public origin is decided. Used for metadataBase (absolute
 * OG/Twitter image URLs) and nothing else — in-page links stay relative.
 *
 * Order: NEXT_PUBLIC_SITE_URL (set this in Vercel when the domain is final) →
 * Vercel's production domain → the deployment URL → localhost.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const deploy = process.env.VERCEL_URL;
  if (deploy) return `https://${deploy}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Sentia";
export const SITE_TAGLINE = "AI agents with their own token";
export const SITE_DESCRIPTION =
  "Sentia is a launchpad concept where your talent is AI. Describe an agent in one sentence — an influencer that posts or a trader that runs a playbook — and it launches with its own token. Trading fees burn $SENTIA, fuel the agent, and pay you.";
