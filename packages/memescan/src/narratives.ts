import { NarrativeCluster, RiskReport, TokenSnapshot } from "./types";

interface LexiconMeta {
  id: string;
  label: string;
  words: string[];
}

/**
 * Known metas. A token joins a meta when its name/symbol/description contains
 * one of the words (whole-word match after normalization).
 */
const LEXICON: LexiconMeta[] = [
  {
    id: "regular-guy",
    label: "Regular-guy character meta (jimothy-core)",
    // The "some guy named Jimothy" meta: coins that are just A Dude With A Name.
    words: [
      "jimothy", "timothy", "jerry", "gary", "greg", "kevin", "brian", "chad",
      "dave", "steve", "carl", "doug", "terry", "frank", "walter", "harold",
      "keith", "larry", "barry", "bert", "felix", "cletus", "randy", "todd",
      "phil", "stanley", "eugene", "bernard", "gerald", "herbert", "marvin",
      "norman", "clyde", "dennis", "wally", "gustavo", "jeff", "craig",
    ],
  },
  {
    id: "dog",
    label: "Dog szn",
    words: ["dog", "doge", "shib", "shiba", "inu", "pup", "puppy", "woof", "floki", "bonk", "hound"],
  },
  {
    id: "cat",
    label: "Cat coins",
    words: ["cat", "kitty", "kitten", "meow", "popcat", "mog", "purr"],
  },
  {
    id: "frog",
    label: "Frog/Pepe lineage",
    words: ["frog", "pepe", "toad", "apu", "peepo", "ribbit"],
  },
  {
    id: "ai",
    label: "AI agents",
    words: ["ai", "agent", "gpt", "neural", "terminal", "sentient", "llm", "bot"],
  },
  {
    id: "politics",
    label: "Politics/patriot",
    words: ["trump", "maga", "biden", "president", "patriot", "freedom", "america", "election"],
  },
  {
    id: "celeb",
    label: "Celebrity bait",
    words: ["elon", "musk", "kanye", "drake", "snoop", "messi", "ronaldo", "lebron"],
  },
  {
    id: "chonk",
    label: "Chunky-animal meta",
    words: ["hippo", "moodeng", "capybara", "penguin", "pengu", "squirrel", "pnut", "hamster", "walrus", "manatee"],
  },
  {
    id: "food",
    label: "Food coins",
    words: ["burger", "taco", "pizza", "banana", "corn", "pickle", "hotdog", "donut", "spaghetti"],
  },
  {
    id: "baby",
    label: "Baby-fork meta",
    words: ["baby", "mini", "junior"],
  },
  {
    id: "wojak",
    label: "Wojak/doomer",
    words: ["wojak", "doomer", "npc", "chud", "bobo"],
  },
  {
    id: "hat",
    label: "Hat/wif derivatives",
    words: ["wif", "hat", "cap"],
  },
  {
    id: "cult",
    label: "Cult/deity coins",
    words: ["god", "jesus", "cult", "church", "holy", "saint"],
  },
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "coin", "token", "meme", "official", "com",
  "www", "http", "https", "org", "app", "xyz", "fun", "pump", "moon", "sol",
  "eth", "bsc", "base", "chain", "crypto", "finance", "protocol", "network",
  "v2", "2", "of", "on", "in", "by", "to", "is", "its", "new", "one",
]);

/** Split a token's visible text into normalized whole words. */
export function tokenWords(t: TokenSnapshot): string[] {
  const text = `${t.name} ${t.symbol} ${t.description ?? ""}`.toLowerCase();
  const words = text
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildCluster(
  id: string,
  label: string,
  kind: "lexicon" | "emergent",
  tokens: TokenSnapshot[],
  riskByToken: Map<string, RiskReport>,
  now: number
): NarrativeCluster {
  const dayAgo = now - 24 * 3600 * 1000;
  const newTokens24h = tokens.filter(
    (t) => t.pairCreatedAt !== null && t.pairCreatedAt >= dayAgo
  ).length;
  const totalVolume24hUsd = tokens.reduce((s, t) => s + (t.volume24hUsd ?? 0), 0);
  const changes = tokens
    .map((t) => t.priceChange.h24)
    .filter((c): c is number => c !== null);
  const risks = tokens.map(
    (t) => riskByToken.get(`${t.chainId}:${t.address}`)?.score ?? 0
  );
  const avgRiskScore =
    risks.length > 0 ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;
  const medianChange24h = median(changes);

  // Momentum: activity (log-volume), breadth (token count), freshness (new
  // launches), and direction (median 24h change, clamped so one 90x doesn't
  // dominate the board).
  const momentum =
    Math.log10(totalVolume24hUsd + 1) * 2 +
    tokens.length * 1.5 +
    newTokens24h * 2.5 +
    Math.max(-3, Math.min(3, (medianChange24h ?? 0) / 100));

  return {
    id,
    label,
    kind,
    tokens,
    momentum: Math.round(momentum * 10) / 10,
    stats: {
      tokenCount: tokens.length,
      newTokens24h,
      totalVolume24hUsd,
      medianChange24h,
      avgRiskScore: Math.round(avgRiskScore),
    },
  };
}

/**
 * Cluster the scanned tokens into narratives: known metas from the lexicon,
 * plus emergent metas — any non-lexicon word shared by 3+ distinct tokens in
 * this scan is a narrative forming in real time.
 */
export function clusterNarratives(
  tokens: TokenSnapshot[],
  reports: RiskReport[],
  now = Date.now()
): NarrativeCluster[] {
  const riskByToken = new Map(reports.map((r) => [`${r.token.chainId}:${r.token.address}`, r]));
  const wordsByToken = new Map(tokens.map((t) => [t, tokenWords(t)]));
  const lexiconWords = new Set(LEXICON.flatMap((m) => m.words));

  const clusters: NarrativeCluster[] = [];

  for (const meta of LEXICON) {
    const wordSet = new Set(meta.words);
    const members = tokens.filter((t) =>
      (wordsByToken.get(t) ?? []).some((w) => wordSet.has(w))
    );
    if (members.length > 0) {
      clusters.push(buildCluster(meta.id, meta.label, "lexicon", members, riskByToken, now));
    }
  }

  // Emergent narratives from raw word frequency.
  const byWord = new Map<string, TokenSnapshot[]>();
  for (const [t, words] of wordsByToken) {
    for (const w of words) {
      if (w.length < 3 || lexiconWords.has(w) || /^\d+$/.test(w)) continue;
      byWord.set(w, [...(byWord.get(w) ?? []), t]);
    }
  }
  const claimed = new Set(
    clusters.flatMap((c) => c.tokens.map((t) => `${t.chainId}:${t.address}`))
  );
  const emergent = [...byWord.entries()]
    .filter(([, ts]) => ts.length >= 3)
    // Prefer clusters made mostly of tokens no known meta explains.
    .map(([w, ts]) => ({
      word: w,
      tokens: ts,
      novel: ts.filter((t) => !claimed.has(`${t.chainId}:${t.address}`)).length,
    }))
    .filter((e) => e.novel >= 2)
    .sort((a, b) => b.tokens.length - a.tokens.length)
    .slice(0, 8);

  for (const e of emergent) {
    clusters.push(
      buildCluster(`emergent-${e.word}`, `"${e.word}" meta (emerging)`, "emergent", e.tokens, riskByToken, now)
    );
  }

  return clusters.sort((a, b) => b.momentum - a.momentum);
}
