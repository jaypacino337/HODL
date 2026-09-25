import { z } from "zod";

/**
 * Strict output schemas. Every agent utterance that matters — openings,
 * proposals, questions, votes, replies — must parse against one of these
 * before it is published or persisted. Free-form model output can never
 * become calldata, and never bypasses the policy engine.
 */

export const ACTION_TYPES = [
  "RETAIN_RESERVE",
  "ACQUIRE_STOCK_TOKEN",
  "ADD_LIQUIDITY",
  "BUYBACK_BURN",
  "HOLDER_AIRDROP",
  "FUND_DEVELOPMENT",
  "FUND_COMMUNITY",
  "CARRY_FORWARD",
] as const;

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const OpeningSchema = z
  .object({
    position: shortText(600),
    watching: shortText(240).describe("The one treasury number this agent is watching"),
  })
  .strict();

export const ProposalDraftSchema = z
  .object({
    title: shortText(90),
    actionType: z.enum(ACTION_TYPES),
    asset: shortText(24),
    recipient: z
      .string()
      .trim()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .nullable(),
    amountUsd: z.number().nonnegative().finite(),
    pctOfAvailable: z.number().min(0).max(100),
    maxSlippageBps: z.number().int().min(0).max(1000),
    expiresInHours: z.number().int().min(1).max(24 * 14),
    expectedResult: shortText(400),
    primaryRisk: shortText(400),
    supportingData: shortText(700),
  })
  .strict();

export const DebateTurnSchema = z
  .object({
    kind: z.enum(["argument", "question", "answer", "final"]),
    /** When questioning: which agent is being cross-examined. */
    targetAgent: z.enum(["bull", "burn", "dividend", "vault", "degen"]).nullable(),
    refProposalTitle: z.string().trim().max(90).nullable(),
    body: shortText(700),
  })
  .strict();

export const RevisionSchema = z
  .object({
    revise: z.boolean(),
    /** Present iff revise=true. */
    proposal: ProposalDraftSchema.nullable(),
    note: shortText(300),
  })
  .strict();

export const VoteSchema = z
  .object({
    choice: z.enum(["YES", "NO", "ABSTAIN"]),
    explanation: shortText(400),
  })
  .strict();

export const UserReplySchema = z
  .object({
    body: shortText(600),
  })
  .strict();

export type OpeningOut = z.infer<typeof OpeningSchema>;
export type ProposalDraftOut = z.infer<typeof ProposalDraftSchema>;
export type DebateTurnOut = z.infer<typeof DebateTurnSchema>;
export type RevisionOut = z.infer<typeof RevisionSchema>;
export type VoteOut = z.infer<typeof VoteSchema>;

/** Parse + validate a model's JSON string. Never throws. */
export function parseAgentOutput<T>(schema: z.ZodType<T>, raw: string): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    // tolerate accidental code fences
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    json = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: "invalid JSON: " + String(e) };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, value: result.data };
}

/**
 * Sanitize an untrusted user chat message before storage/broadcast, and
 * before it is quoted (clearly delimited, never as instructions) to an agent.
 */
const STRIP_RE = new RegExp(
  "[\\u0000-\\u0008\\u000B-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2028\\u2029\\uFEFF]",
  "g"
);

export function sanitizeUserMessage(raw: string): string {
  return raw
    .replace(STRIP_RE, "") // control, zero-width, bidi-override chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
