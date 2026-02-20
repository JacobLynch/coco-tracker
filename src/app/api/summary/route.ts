import { NextRequest, NextResponse } from "next/server";
import { getSummary, Period } from "@/lib/queries";

const VALID_PERIODS = new Set(["1d", "7d", "1m", "1y", "all"]);

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "1d";

  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json(
      { error: "Invalid period. Use: 1d, 7d, 1m, 1y, all" },
      { status: 400 }
    );
  }

  const summary = await getSummary(period as Period);

  if (!summary) {
    return NextResponse.json(
      { error: "No data available" },
      { status: 404 }
    );
  }

  return NextResponse.json(summary);
}
