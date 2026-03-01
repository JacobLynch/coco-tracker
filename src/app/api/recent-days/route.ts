import { NextResponse } from "next/server";
import { getRecentDays } from "@/lib/queries";

export async function GET() {
  const days = await getRecentDays();
  return NextResponse.json(days);
}
