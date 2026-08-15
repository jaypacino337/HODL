import { AttnConfig } from "@attn/shared";
import { extractTweetId } from "./verify";

export interface AutoVerdict {
  verified: boolean;
  points: number;
  note: string;
}

const BASE_POINTS = 100;

/**
 * Attention-post verification.
 *
 * With X_BEARER_TOKEN set, the engine reads the tweet through the X API v2
 * and auto-approves posts that actually mention the ticker, weighting
 * points by real engagement:
 *
 *   points = 100 + 2×likes + 5×reposts + 3×replies   (capped at 10,000)
 *
 * Without a token, submissions stay `pending` for manual review through
 * the admin endpoint — no fake auto-points, no honor system.
 */
export async function autoVerifyPost(config: AttnConfig, url: string): Promise<AutoVerdict | null> {
  if (!config.xBearerToken) return null;
  const tweetId = extractTweetId(url);
  if (!tweetId) return { verified: false, points: 0, note: "not a status URL" };

  const res = await fetch(
    `https://api.x.com/2/tweets/${tweetId}?tweet.fields=public_metrics,text`,
    { headers: { Authorization: `Bearer ${config.xBearerToken}` } }
  );
  if (!res.ok) {
    throw new Error(`X API -> HTTP ${res.status}`);
  }
  const body: any = await res.json();
  const text: string = body.data?.text ?? "";
  const metrics = body.data?.public_metrics ?? {};

  const tickerBare = config.ticker.replace(/^\$/, "").toLowerCase();
  const mentions =
    text.toLowerCase().includes(config.ticker.toLowerCase()) ||
    text.toLowerCase().includes(`#${tickerBare}`) ||
    text.toLowerCase().includes(tickerBare);
  if (!mentions) {
    return { verified: false, points: 0, note: `post does not mention ${config.ticker}` };
  }

  const engagement =
    2 * Number(metrics.like_count ?? 0) +
    5 * Number(metrics.retweet_count ?? 0) +
    3 * Number(metrics.reply_count ?? 0);
  const points = Math.min(10_000, BASE_POINTS + engagement);
  return {
    verified: true,
    points,
    note: `auto-verified: ${metrics.like_count ?? 0} likes, ${metrics.retweet_count ?? 0} reposts`,
  };
}
