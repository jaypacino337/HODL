import express, { Express } from "express";
import cors from "cors";
import { Connection, PublicKey } from "@solana/web3.js";
import { GameStateResponse, HistoryResponse, HodlConfig, Side, SideTotals } from "@hodl/shared";
import { GameDb } from "./db";
import { getWalletTokenBalance, minHoldRaw } from "./balances";
import { verifyPickSignature } from "./verify";

const VALID_SIDES: Side[] = ["HODL", "NOHODL"];

/**
 * The public game API the website talks to.
 *
 *   GET  /health                     — liveness for Railway
 *   GET  /api/state                  — live round, pot, per-side totals
 *   GET  /api/history                — settled rounds, leaderboard, totals
 *   GET  /api/pick/:round/:wallet    — a wallet's pick for a round
 *   POST /api/pick                   — submit a signed pick
 */
export function buildApi(
  config: HodlConfig,
  connection: Connection,
  db: GameDb,
  tokenDecimals: number
): Express {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: config.corsOrigins === "*" ? true : config.corsOrigins.split(",").map((s) => s.trim()),
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/state", async (_req, res) => {
    try {
      const [round, vaultBalance] = await Promise.all([
        db.getOpenRound(),
        connection.getBalance(config.gameVaultKeypair.publicKey),
      ]);
      const potLamports = String(Math.max(0, vaultBalance - config.vaultReserveLamports));

      const totals: Record<Side, SideTotals> = {
        HODL: { players: 0, weight: "0" },
        NOHODL: { players: 0, weight: "0" },
      };
      if (round) {
        const picks = await db.getPicks(round.id);
        for (const side of VALID_SIDES) {
          const onSide = picks.filter((p) => p.side === side);
          totals[side] = {
            players: onSide.length,
            weight: onSide.reduce((sum, p) => sum + BigInt(p.balanceAtPick), 0n).toString(),
          };
        }
      }

      const [lastRound] = await db.getRoundSummaries(1);

      const body: GameStateResponse = {
        mint: config.mint.toBase58(),
        tokenDecimals,
        minHoldTokens: config.minHoldTokens,
        potLamports,
        round: round
          ? { roundNumber: round.roundNumber, locksAt: round.locksAt, settlesAt: round.settlesAt }
          : null,
        totals,
        lastRound: lastRound ?? null,
      };
      res.json(body);
    } catch (err) {
      console.error("[api] /api/state failed:", (err as Error).message);
      res.status(500).json({ error: "internal error" });
    }
  });

  app.get("/api/history", async (_req, res) => {
    try {
      const [rounds, leaderboard, totals] = await Promise.all([
        db.getRoundSummaries(20),
        db.getLeaderboard(25),
        db.getGameTotals(),
      ]);
      const body: HistoryResponse = { rounds, leaderboard, ...totals };
      res.json(body);
    } catch (err) {
      console.error("[api] /api/history failed:", (err as Error).message);
      res.status(500).json({ error: "internal error" });
    }
  });

  app.get("/api/pick/:roundNumber/:wallet", async (req, res) => {
    try {
      const round = await db.getOpenRound();
      if (!round || round.roundNumber !== Number(req.params.roundNumber)) {
        return res.json({ pick: null });
      }
      const pick = await db.getPick(round.id, req.params.wallet);
      res.json({ pick: pick ? { side: pick.side, pickedAt: pick.pickedAt } : null });
    } catch (err) {
      console.error("[api] /api/pick GET failed:", (err as Error).message);
      res.status(500).json({ error: "internal error" });
    }
  });

  app.post("/api/pick", async (req, res) => {
    try {
      const { wallet, side, roundNumber, signature } = req.body ?? {};

      if (typeof wallet !== "string" || typeof signature !== "string" || !VALID_SIDES.includes(side)) {
        return res.status(400).json({ error: "wallet, side (HODL|NOHODL) and signature are required" });
      }
      let owner: PublicKey;
      try {
        owner = new PublicKey(wallet);
      } catch {
        return res.status(400).json({ error: "invalid wallet address" });
      }
      if (config.excludedOwners.has(wallet)) {
        return res.status(403).json({ error: "this wallet is excluded from playing" });
      }

      const round = await db.getOpenRound();
      if (!round || round.roundNumber !== Number(roundNumber)) {
        return res.status(409).json({ error: "that round is not open — refresh and pick again" });
      }
      if (new Date(round.locksAt).getTime() <= Date.now()) {
        return res.status(409).json({ error: "picks are locked for this round — wait for the next one" });
      }

      if (!verifyPickSignature(round.roundNumber, side, wallet, signature)) {
        return res.status(401).json({ error: "signature does not verify for this pick" });
      }

      const balance = await getWalletTokenBalance(connection, config.mint, owner);
      const threshold = minHoldRaw(config.minHoldTokens, tokenDecimals);
      if (balance < threshold) {
        return res.status(403).json({
          error: `you need at least ${config.minHoldTokens.toLocaleString()} tokens to play`,
          balance: balance.toString(),
          required: threshold.toString(),
        });
      }

      await db.upsertPick({
        roundId: round.id,
        wallet,
        side,
        balanceAtPick: balance.toString(),
        signature,
      });

      res.json({
        ok: true,
        roundNumber: round.roundNumber,
        side,
        balance: balance.toString(),
        locksAt: round.locksAt,
        settlesAt: round.settlesAt,
      });
    } catch (err) {
      console.error("[api] /api/pick POST failed:", (err as Error).message);
      res.status(500).json({ error: "internal error" });
    }
  });

  return app;
}
