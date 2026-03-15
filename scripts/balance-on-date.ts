import { createClient } from "@libsql/client";

const date = process.argv[2];
if (!date) {
  console.error("Usage: npm run balance-on-date -- 2025-01-15");
  process.exit(1);
}

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Get exact date or closest date on or before
  const result = await db.execute({
    sql: `SELECT date, personal_balance, end_balance, daily_growth, realized_profit,
                 deposits, withdrawals, start_balance
          FROM daily_performance
          WHERE date <= ?
          ORDER BY date DESC
          LIMIT 1`,
    args: [date],
  });

  if (result.rows.length === 0) {
    console.log(`No data found on or before ${date}`);
    process.exit(1);
  }

  const row = result.rows[0];
  const matchDate = row.date as string;

  console.log(`\n  Balance on ${matchDate}${matchDate !== date ? ` (closest to ${date})` : ""}`);
  console.log(`  ${"─".repeat(40)}`);
  console.log(`  Your Balance:    $${(row.personal_balance as number)?.toFixed(2) ?? "N/A"}`);
  console.log(`  Fund Total:      $${(row.end_balance as number).toFixed(2)}`);
  console.log(`  Daily Growth:    ${(row.daily_growth as number)?.toFixed(2) ?? "N/A"}%`);
  const grossProfit = row.realized_profit as number;
  console.log(`  Realized Profit: $${grossProfit?.toFixed(2) ?? "N/A"} (gross) / $${grossProfit != null ? (grossProfit * 0.75).toFixed(2) : "N/A"} (your 75%)`);

  // Also show account events on that date
  const events = await db.execute({
    sql: `SELECT type, amount, notes FROM account_events WHERE substr(date, 1, 10) = ?`,
    args: [matchDate],
  });

  if (events.rows.length > 0) {
    console.log(`\n  Account Events:`);
    for (const e of events.rows) {
      const sign = e.type === "CONTRIBUTION" ? "+" : e.type === "WITHDRAWAL" ? "-" : "=";
      console.log(`    ${sign}$${(e.amount as number).toFixed(2)} (${e.type}${e.notes ? ` - ${e.notes}` : ""})`);
    }
  }

  console.log();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
