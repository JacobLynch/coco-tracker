const BASE_URL = process.env.FINANCE_API_BASE_URL!;
const SITE_ID = process.env.FINANCE_SITE_ID || "3";

interface LoginResponse {
  status: string;
  user: {
    data: {
      accounts: { id: number; descriptive_name: string }[];
    };
  };
  authorisation: {
    token: string;
    type: string;
  };
}

export interface DailyPerformanceRow {
  date: string;
  startBalance: string;
  endBalance: string;
  wonCount: number;
  lostCount: number;
  winRate: string | number;
  deposits: string;
  withdrawals: string;
  profit: string | number;
  growthdaily: number;
  growth: number;
}

interface DailyPerformanceResponse {
  data: {
    recentTransactions: {
      data: DailyPerformanceRow[];
    };
  };
}

export class FinanceClient {
  private token: string | null = null;
  private accountId: number | null = null;

  async login(): Promise<void> {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://dashboard.cococapital.llc",
        referer: "https://dashboard.cococapital.llc/",
      },
      body: JSON.stringify({
        email: process.env.FINANCE_USERNAME,
        password: process.env.FINANCE_PASSWORD,
        siteId: SITE_ID,
      }),
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${res.statusText}`);
    }

    const data: LoginResponse = await res.json();
    if (data.status !== "success") {
      throw new Error(`Login failed: ${data.status}`);
    }

    this.token = data.authorisation.token;
    this.accountId = data.user.data.accounts[0].id;
  }

  async getDailyPerformance(
    startDate: string,
    endDate: string
  ): Promise<DailyPerformanceRow[]> {
    if (!this.token || !this.accountId) {
      throw new Error("Must call login() first");
    }

    const res = await fetch(
      `${BASE_URL}/daily-performance-report/${this.accountId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
          origin: "https://dashboard.cococapital.llc",
          referer: "https://dashboard.cococapital.llc/",
        },
        body: JSON.stringify({ startDate, endDate }),
      }
    );

    if (!res.ok) {
      throw new Error(
        `Daily performance fetch failed: ${res.status} ${res.statusText}`
      );
    }

    const data: DailyPerformanceResponse = await res.json();
    return data.data.recentTransactions.data;
  }
}

/** Parse a row from the API into values ready for DB insert. */
export function parseRow(row: DailyPerformanceRow) {
  const won = row.wonCount;
  const lost = row.lostCount;
  const totalTrades = won + lost;
  const winRate =
    typeof row.winRate === "string" ? parseFloat(row.winRate) : row.winRate;
  const profit =
    typeof row.profit === "string" ? parseFloat(row.profit) : row.profit;

  return {
    date: row.date,
    start_balance: parseFloat(row.startBalance),
    end_balance: parseFloat(row.endBalance),
    won,
    lost,
    total_trades: totalTrades,
    win_rate: winRate,
    deposits: parseFloat(row.deposits),
    withdrawals: parseFloat(row.withdrawals),
    realized_profit: profit,
    daily_growth: row.growthdaily,
    running_growth: row.growth,
  };
}
