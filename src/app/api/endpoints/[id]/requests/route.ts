import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookRequests } from "@/db/schema";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: endpointId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() || "";
    const methodFilter = searchParams.get("method")?.trim().toUpperCase() || "";

    const conditions = [eq(webhookRequests.endpointId, endpointId)];

    if (methodFilter && methodFilter !== "ALL") {
      conditions.push(eq(webhookRequests.method, methodFilter));
    }

    if (query) {
      const searchPattern = `%${query}%`;
      conditions.push(
        or(
          ilike(webhookRequests.method, searchPattern),
          ilike(webhookRequests.path, searchPattern),
          ilike(webhookRequests.rawBody, searchPattern),
          ilike(webhookRequests.contentType, searchPattern),
          sql`CAST(${webhookRequests.headers} AS TEXT) ILIKE ${searchPattern}`,
          sql`CAST(${webhookRequests.query} AS TEXT) ILIKE ${searchPattern}`
        )!
      );
    }

    const requests = await db
      .select()
      .from(webhookRequests)
      .where(and(...conditions))
      .orderBy(desc(webhookRequests.receivedAt))
      .limit(100);

    return NextResponse.json({ requests }, { status: 200 });
  } catch (err) {
    console.error("Error fetching requests:", err);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: endpointId } = await params;

    await db
      .delete(webhookRequests)
      .where(eq(webhookRequests.endpointId, endpointId));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error clearing requests:", err);
    return NextResponse.json(
      { error: "Failed to clear requests" },
      { status: 500 }
    );
  }
}
