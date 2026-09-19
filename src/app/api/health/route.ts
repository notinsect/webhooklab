import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Ping database with a lightweight query
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("Health check failure:", err);
    return NextResponse.json(
      { status: "error", error: "Database unreachable" },
      { status: 503 }
    );
  }
}
