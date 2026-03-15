import { schedules, logger } from "@trigger.dev/sdk";
import { createClient } from "@libsql/client";
import { FinanceClient } from "../lib/finance-client";
import { extractText } from "unpdf";

/** Parse month name from statement doc name, e.g. "Coco Capital Statement [Feb, 2026]" → "2026-02" */
function parseStatementMonth(name: string): string | null {
  const match = name.match(/\[(\w+),\s*(\d{4})\]/);
  if (!match) return null;

  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };

  const monthNum = months[match[1]];
  if (!monthNum) return null;
  return `${match[2]}-${monthNum}`;
}

/** Extract "Current Balance" dollar amount from statement PDF text */
function parseEndingBalance(text: string): number | null {
  // Look for "Current Balance" followed by a dollar amount
  const match = text.match(/Current\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ""));
  }

  // Fallback: look for "Ending Balance" in table rows
  const fallback = text.match(/Ending\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i);
  if (fallback) {
    return parseFloat(fallback[1].replace(/,/g, ""));
  }

  return null;
}

export const syncStatements = schedules.task({
  id: "sync-statements",
  cron: "30 6 * * *", // daily at 6:30 AM UTC
  run: async () => {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const client = new FinanceClient();

    logger.info("Logging in...");
    await client.login();

    // 1. List all statement docs
    const docs = await client.listDocs();
    const stmtDocs = docs.filter((d) => d.type === "STMT");
    logger.info(`Found ${stmtDocs.length} statement docs`);

    // 2. Get existing TRUE_UP events to know which months we've already processed
    const existing = await db.execute(
      "SELECT substr(date, 1, 7) as month FROM account_events WHERE type = 'TRUE_UP'"
    );
    const processedMonths = new Set(
      existing.rows.map((r) => r.month as string)
    );

    for (const doc of stmtDocs) {
      const month = parseStatementMonth(doc.name);
      if (!month) {
        logger.warn(`Could not parse month from doc: ${doc.name}`);
        continue;
      }

      if (processedMonths.has(month)) {
        logger.info(`Already have TRUE_UP for ${month}, skipping`);
        continue;
      }

      // 3. Download and parse the PDF
      logger.info(`Processing statement for ${month}: ${doc.name}`);
      const pdfBuffer = await client.downloadDoc(doc.id);
      const { text } = await extractText(new Uint8Array(pdfBuffer));
      const fullText = Array.isArray(text) ? text.join("\n") : text;
      const balance = parseEndingBalance(fullText);

      if (balance === null) {
        logger.error(
          `Could not parse ending balance from PDF for ${month}. Text preview: ${fullText.slice(0, 500)}`
        );
        continue;
      }

      if (balance === 0) {
        logger.info(`Skipping ${month} — zero balance`);
        continue;
      }

      // 4. Find the last trading day of that month in our data
      const lastDay = await db.execute({
        sql: `SELECT MAX(date) as date FROM daily_performance WHERE date LIKE ?`,
        args: [`${month}%`],
      });

      const trueUpDate = (lastDay.rows[0]?.date as string) || `${month}-28`;

      // 5. Insert the TRUE_UP event
      await db.execute({
        sql: `INSERT INTO account_events (date, type, amount, notes)
              VALUES (?, 'TRUE_UP', ?, ?)`,
        args: [
          trueUpDate,
          balance,
          `From statement: ${doc.name}`,
        ],
      });

      logger.info(
        `Inserted TRUE_UP for ${month}: $${balance.toFixed(2)} on ${trueUpDate}`
      );
      processedMonths.add(month);
    }

    // 6. If we inserted any new TRUE_UPs, recompute the balance chain
    if (processedMonths.size > existing.rows.length) {
      logger.info("Recomputing personal_balance chain...");

      const events = await db.execute(
        "SELECT substr(date, 1, 10) as date, type, amount FROM account_events ORDER BY date"
      );
      const eventsByDate = new Map<
        string,
        { type: string; amount: number }[]
      >();
      for (const e of events.rows) {
        const d = e.date as string;
        if (!eventsByDate.has(d)) eventsByDate.set(d, []);
        eventsByDate.get(d)!.push({
          type: e.type as string,
          amount: e.amount as number,
        });
      }

      const perfRows = await db.execute(
        "SELECT date, daily_growth FROM daily_performance ORDER BY date"
      );

      let balance = 0;
      const updates: { date: string; personal_balance: number }[] = [];

      for (const row of perfRows.rows) {
        const date = row.date as string;
        const dailyGrowth = row.daily_growth as number;

        const dayEvents = eventsByDate.get(date) || [];
        let hadTrueUp = false;
        for (const ev of dayEvents) {
          if (ev.type === "CONTRIBUTION") {
            balance += ev.amount;
          } else if (ev.type === "WITHDRAWAL") {
            balance -= ev.amount;
          } else if (ev.type === "TRUE_UP") {
            balance = ev.amount;
            hadTrueUp = true;
          }
        }

        if (!hadTrueUp && balance > 0 && dailyGrowth !== 0) {
          balance = balance * (1 + (dailyGrowth * 0.75) / 100);
        }

        updates.push({ date, personal_balance: balance });
      }

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
      logger.info(
        `Recomputed ${updates.length} rows. Latest: $${last.personal_balance.toFixed(2)} on ${last.date}`
      );
    }
  },
});
