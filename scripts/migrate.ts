import { createClient } from "@libsql/client";

async function migrate() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const statements = [
    `CREATE TABLE IF NOT EXISTS daily_performance (
      date              TEXT PRIMARY KEY,
      start_balance     REAL NOT NULL,
      end_balance       REAL NOT NULL,
      won               INTEGER,
      lost              INTEGER,
      total_trades      INTEGER,
      win_rate          REAL,
      deposits          REAL,
      withdrawals       REAL,
      realized_profit   REAL,
      daily_growth      REAL,
      running_growth    REAL,
      personal_balance  REAL,
      scraped_at        TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_daily_perf_date ON daily_performance(date)`,
    `CREATE TABLE IF NOT EXISTS account_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT NOT NULL,
      type            TEXT NOT NULL CHECK (type IN ('CONTRIBUTION', 'WITHDRAWAL', 'TRUE_UP')),
      amount          REAL NOT NULL,
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_account_events_date ON account_events(date)`,
  ];

  // Migration: update CHECK constraint to allow TRUE_UP
  // SQLite can't ALTER CHECK constraints, so recreate the table if needed
  const hasOldConstraint = await db.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='account_events'`
  );
  if (
    hasOldConstraint.rows.length > 0 &&
    !(hasOldConstraint.rows[0].sql as string).includes("TRUE_UP")
  ) {
    console.log("Migrating account_events to allow TRUE_UP type...");
    await db.batch([
      {
        sql: `CREATE TABLE account_events_new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          date            TEXT NOT NULL,
          type            TEXT NOT NULL CHECK (type IN ('CONTRIBUTION', 'WITHDRAWAL', 'TRUE_UP')),
          amount          REAL NOT NULL,
          notes           TEXT,
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      {
        sql: `INSERT INTO account_events_new SELECT * FROM account_events`,
        args: [],
      },
      { sql: `DROP TABLE account_events`, args: [] },
      {
        sql: `ALTER TABLE account_events_new RENAME TO account_events`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_account_events_date ON account_events(date)`,
        args: [],
      },
    ]);
    console.log("Migration complete: account_events updated.");
  }

  for (const sql of statements) {
    await db.execute(sql);
  }

  console.log("Migration complete: tables and indexes created.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
