import { createClient } from "@libsql/client";

async function recompute() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

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
    console.error("No account_events found. Cannot compute personal_balance.");
    process.exit(1);
  }

  // Read all daily_performance rows in date order
  const perfRows = await db.execute(
    "SELECT date, daily_growth FROM daily_performance ORDER BY date"
  );

  console.log(`Recomputing personal_balance for ${perfRows.rows.length} rows...`);

  let balance = 0;
  const updates: { date: string; personal_balance: number }[] = [];

  for (const row of perfRows.rows) {
    const date = row.date as string;
    const dailyGrowth = row.daily_growth as number;

    // Apply account events for this date
    const dayEvents = eventsByDate.get(date) || [];
    for (const ev of dayEvents) {
      if (ev.type === "CONTRIBUTION") {
        balance += ev.amount;
      } else if (ev.type === "WITHDRAWAL") {
        balance -= ev.amount;
      }
    }

    // Apply daily growth
    if (balance > 0 && dailyGrowth !== 0) {
      balance = balance * (1 + dailyGrowth / 100);
    }

    updates.push({ date, personal_balance: balance });
  }

  // Batch update
  const BATCH_SIZE = 20;
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
    `Done. Latest: $${last.personal_balance.toFixed(2)} on ${last.date}`
  );
}

recompute().catch((err) => {
  console.error("Recompute failed:", err);
  process.exit(1);
});
