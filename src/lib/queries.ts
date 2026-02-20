import { db } from "./db";

export type Period = "1d" | "7d" | "1m" | "1y" | "all";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;

  const now = new Date();
  switch (period) {
    case "1d":
      now.setDate(now.getDate() - 1);
      break;
    case "7d":
      now.setDate(now.getDate() - 7);
      break;
    case "1m":
      now.setMonth(now.getMonth() - 1);
      break;
    case "1y":
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now.toISOString().slice(0, 10);
}

export async function getSummary(period: Period) {
  // Latest row with personal_balance
  const latest = await db.execute(
    `SELECT date, personal_balance, daily_growth, end_balance, realized_profit,
            won, lost, total_trades, win_rate, running_growth
     FROM daily_performance
     WHERE personal_balance IS NOT NULL
     ORDER BY date DESC LIMIT 1`
  );

  if (latest.rows.length === 0) return null;

  const current = latest.rows[0];
  const currentBalance = current.personal_balance as number;

  // Find the balance at the start of the period
  const targetDate = periodToDate(period);

  let periodStartBalance: number;

  if (targetDate === null) {
    // "all" — get the very first row with personal_balance
    const first = await db.execute(
      `SELECT personal_balance FROM daily_performance
       WHERE personal_balance IS NOT NULL AND personal_balance > 0
       ORDER BY date ASC LIMIT 1`
    );
    periodStartBalance =
      first.rows.length > 0 ? (first.rows[0].personal_balance as number) : currentBalance;
  } else {
    // Get the closest row on or before the target date with a positive balance
    const start = await db.execute({
      sql: `SELECT personal_balance FROM daily_performance
            WHERE date <= ? AND personal_balance IS NOT NULL AND personal_balance > 0
            ORDER BY date DESC LIMIT 1`,
      args: [targetDate],
    });

    if (start.rows.length > 0) {
      periodStartBalance = start.rows[0].personal_balance as number;
    } else {
      // Period predates contribution — fall back to first non-zero balance
      const first = await db.execute(
        `SELECT personal_balance FROM daily_performance
         WHERE personal_balance IS NOT NULL AND personal_balance > 0
         ORDER BY date ASC LIMIT 1`
      );
      periodStartBalance =
        first.rows.length > 0 ? (first.rows[0].personal_balance as number) : currentBalance;
    }
  }

  const periodChangeUsd = currentBalance - periodStartBalance;
  const periodChangePct =
    periodStartBalance !== 0
      ? (periodChangeUsd / periodStartBalance) * 100
      : 0;

  return {
    current_balance: currentBalance,
    period_change_usd: periodChangeUsd,
    period_change_pct: periodChangePct,
    fund_balance: current.end_balance as number,
    as_of: current.date as string,
  };
}
