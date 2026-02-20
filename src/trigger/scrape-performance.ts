import { schedules, logger } from "@trigger.dev/sdk";
import { createClient } from "@libsql/client";
import { FinanceClient, parseRow } from "../lib/finance-client";

function getDateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(from), endDate: fmt(to) };
}

export const scrapePerformance = schedules.task({
  id: "scrape-performance",
  cron: "0 * * * *",
  run: async () => {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const client = new FinanceClient();

    // 1. Login
    logger.info("Logging in...");
    await client.login();

    // 2. Fetch last 5 days to catch corrections
    const { startDate, endDate } = getDateRange(5);
    logger.info(`Fetching daily performance ${startDate} to ${endDate}`);
    const rows = await client.getDailyPerformance(startDate, endDate);
    logger.info(`Fetched ${rows.length} rows`);

    if (rows.length === 0) {
      logger.info("No data returned, skipping.");
      return;
    }

    // 3. Parse and upsert rows
    const parsed = rows
      .map(parseRow)
      .sort((a, b) => a.date.localeCompare(b.date));

    await db.batch(
      parsed.map((r) => ({
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
    logger.info(`Upserted ${parsed.length} rows`);

    // 4. Recompute personal_balance for the upserted date range
    //    Get balance from the day before our range
    const earliestDate = parsed[0].date;
    const prior = await db.execute({
      sql: `SELECT personal_balance FROM daily_performance
            WHERE date < ? AND personal_balance IS NOT NULL
            ORDER BY date DESC LIMIT 1`,
      args: [earliestDate],
    });

    if (prior.rows.length === 0) {
      logger.info("No prior personal_balance found, skipping balance computation.");
      return;
    }

    let balance = prior.rows[0].personal_balance as number;

    // Load account events
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

    // Walk forward through upserted rows
    const updates: { date: string; personal_balance: number }[] = [];
    for (const row of parsed) {
      const dayEvents = eventsByDate.get(row.date) || [];
      for (const ev of dayEvents) {
        if (ev.type === "CONTRIBUTION") balance += ev.amount;
        else if (ev.type === "WITHDRAWAL") balance -= ev.amount;
      }

      if (balance > 0 && row.daily_growth !== 0) {
        balance = balance * (1 + row.daily_growth / 100);
      }
      updates.push({ date: row.date, personal_balance: balance });
    }

    await db.batch(
      updates.map((u) => ({
        sql: "UPDATE daily_performance SET personal_balance = ? WHERE date = ?",
        args: [u.personal_balance, u.date],
      }))
    );

    logger.info(
      `Recomputed personal_balance for ${updates.length} rows. Latest: $${balance.toFixed(2)}`
    );
  },
});
