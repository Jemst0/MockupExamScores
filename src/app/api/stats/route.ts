import { connection, NextResponse } from "next/server";
import { getCohortStats } from "@/lib/sheets";

export async function GET() {
  await connection();
  try {
    const stats = await getCohortStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[stats] error:", err);
    return NextResponse.json(
      { scoredCount: null, registeredCount: null, hubsCount: null },
      { status: 200 }
    );
  }
}
