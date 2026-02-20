import { createClient } from "@libsql/client";
import { FinanceClient, parseRow } from "../src/lib/finance-client";

async function backfill() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const client = new FinanceClient();

  // 1. Login
  console.log("Logging in...");
  await client.login();

  // 2. Fetch all historical data (use a wide date range)
  console.log("Fetching all historical daily performance...");
  const rows = await client.getDailyPerformance("2020-01-01", "2030-12-31");
  console.log(`Fetched ${rows.length} rows`);

  if (rows.length === 0) {
    console.log("No data to backfill.");
    return;
  }

  // 3. Insert all rows (sorted by date ascending)
  const parsed = rows.map(parseRow).sort((a, b) => a.date.localeCompare(b.date));

  console.log(
    `Date range: ${parsed[0].date} to ${parsed[parsed.length - 1].date}`
  );

  console.log("Inserting rows...");
  // Batch in groups of 20 to avoid hitting request limits
  const BATCH_SIZE = 20;
  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const batch = parsed.slice(i, i + BATCH_SIZE);
    await db.batch(
      batch.map((r) => ({
        sql: `INSERT OR REPLACE INTO daily_performance
              (date, start_balance, end_balance, won, lost, total_trades,
               win_rate, deposits, withdrawals, realized_profit,
               daily_growth, running_growth)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          r.date,
          r.start_balance,
          r.end_balance,
          r.won,
          r.lost,
          r.total_trades,
          r.win_rate,
          r.deposits,
          r.withdrawals,
          r.realized_profit,
          r.daily_growth,
          r.running_growth,
        ],
      }))
    );
  }
  console.log(`Inserted ${parsed.length} rows into daily_performance`);

  // 4. Compute personal_balance chain
  console.log("Computing personal_balance chain...");

  // Read all account events
  const events = await db.execute(
    "SELECT substr(date, 1, 10) as date, type, amount FROM account_events ORDER BY date"
  );
  const eventsByDate = new Map<string, { type: string; amount: number }[]>();
  for (const e of events.rows) {
    const d = e.date as string;
    if (!eventsByDate.has(d)) eventsByDate.set(d, []);
    eventsByDate.get(d)!.push({
      type: e.type as string,
      amount: e.amount as number,
    });
  }

  if (eventsByDate.size === 0) {
    console.warn(
      "WARNING: No account_events found. personal_balance will not be computed."
    );
    console.warn(
      "Insert your initial contribution first, then run: npm run recompute-balances"
    );
    return;
  }

  // Walk forward through all dates, computing personal_balance
  let balance = 0;
  const updates: { date: string; personal_balance: number }[] = [];

  for (const row of parsed) {
    // Apply account events for this date (before growth)
    const dayEvents = eventsByDate.get(row.date) || [];
    for (const ev of dayEvents) {
      if (ev.type === "CONTRIBUTION") {
        balance += ev.amount;
      } else if (ev.type === "WITHDRAWAL") {
        balance -= ev.amount;
      }
    }

    // Apply daily growth
    if (balance > 0 && row.daily_growth !== 0) {
      balance = balance * (1 + row.daily_growth / 100);
    }

    updates.push({ date: row.date, personal_balance: balance });
  }

  // Batch update personal_balance
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await db.batch(
      batch.map((u) => ({
        sql: "UPDATE daily_performance SET personal_balance = ? WHERE date = ?",
        args: [u.personal_balance, u.date],
      }))
    );
  }

  const last = updates[updates.length - 1];
  console.log(
    `Personal balance chain computed. Latest: $${last.personal_balance.toFixed(2)} on ${last.date}`
  );
  console.log("Backfill complete!");
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
