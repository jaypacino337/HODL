import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import type { DistributionRecord, HolderBalance, SnapshotSummary } from "@sherwood/shared";

export class SherwoodDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taken_at TEXT NOT NULL,
        holder_count INTEGER NOT NULL,
        total_eligible_supply TEXT NOT NULL,
        rewards_pool_lamports TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS holders (
        snapshot_id INTEGER NOT NULL,
        owner TEXT NOT NULL,
        token_account TEXT NOT NULL,
        amount TEXT NOT NULL,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
      );
      CREATE INDEX IF NOT EXISTS idx_holders_snapshot ON holders(snapshot_id);

      CREATE TABLE IF NOT EXISTS distributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        owner TEXT NOT NULL,
        amount_lamports TEXT NOT NULL,
        signature TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
      );
      CREATE INDEX IF NOT EXISTS idx_distributions_snapshot ON distributions(snapshot_id);

      CREATE TABLE IF NOT EXISTS harvests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taken_at TEXT NOT NULL DEFAULT (datetime('now')),
        source TEXT NOT NULL,
        lamports TEXT NOT NULL,
        signature TEXT
      );
    `);
  }

  insertSnapshot(summary: Omit<SnapshotSummary, "id">): number {
    const stmt = this.db.prepare(
      `INSERT INTO snapshots (taken_at, holder_count, total_eligible_supply, rewards_pool_lamports)
       VALUES (@takenAt, @holderCount, @totalEligibleSupply, @rewardsPoolLamports)`
    );
    const result = stmt.run(summary);
    return Number(result.lastInsertRowid);
  }

  insertHolders(snapshotId: number, holders: HolderBalance[]) {
    const stmt = this.db.prepare(
      `INSERT INTO holders (snapshot_id, owner, token_account, amount) VALUES (?, ?, ?, ?)`
    );
    const insertMany = this.db.transaction((rows: HolderBalance[]) => {
      for (const h of rows) stmt.run(snapshotId, h.owner, h.tokenAccount, h.amount);
    });
    insertMany(holders);
  }

  insertDistribution(
    snapshotId: number,
    owner: string,
    amountLamports: string,
    signature: string | null,
    status: DistributionRecord["status"]
  ) {
    this.db
      .prepare(
        `INSERT INTO distributions (snapshot_id, owner, amount_lamports, signature, status)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(snapshotId, owner, amountLamports, signature, status);
  }

  insertHarvest(source: string, lamports: string, signature: string | null) {
    this.db.prepare(`INSERT INTO harvests (source, lamports, signature) VALUES (?, ?, ?)`).run(source, lamports, signature);
  }

  getLatestSnapshot(): SnapshotSummary | null {
    const row = this.db
      .prepare(
        `SELECT id, taken_at as takenAt, holder_count as holderCount,
                total_eligible_supply as totalEligibleSupply, rewards_pool_lamports as rewardsPoolLamports
         FROM snapshots ORDER BY id DESC LIMIT 1`
      )
      .get() as SnapshotSummary | undefined;
    return row ?? null;
  }

  getTotalDistributedLamports(): string {
    const row = this.db
      .prepare(`SELECT COALESCE(SUM(CAST(amount_lamports AS INTEGER)), 0) as total FROM distributions WHERE status = 'sent'`)
      .get() as { total: number };
    return String(row.total);
  }

  getTotalHarvestedLamports(): string {
    const row = this.db.prepare(`SELECT COALESCE(SUM(CAST(lamports AS INTEGER)), 0) as total FROM harvests`).get() as {
      total: number;
    };
    return String(row.total);
  }

  getRecentDistributions(snapshotId: number, limit = 50): DistributionRecord[] {
    return this.db
      .prepare(
        `SELECT snapshot_id as snapshotId, owner, amount_lamports as amountLamports, signature, status
         FROM distributions WHERE snapshot_id = ? ORDER BY id DESC LIMIT ?`
      )
      .all(snapshotId, limit) as DistributionRecord[];
  }

  close() {
    this.db.close();
  }
}
