import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookRequests } from "@/db/schema";
import { getSessionUser, verifyEndpointOwnership } from "@/lib/auth";
import { eq, desc, and, ilike, or, sql, count } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: endpointId } = await params;
    const isOwner = await verifyEndpointOwnership(endpointId, session.userId);
    if (!isOwner) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() || "";
    const methodFilter = searchParams.get("method")?.trim().toUpperCase() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

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
          sql`CAST(${webhookRequests.query} AS TEXT) ILIKE ${searchPattern}`
        )!
      );
    }

    const whereClause = and(...conditions);

    // Get total matching count & paginated requests concurrently
    const [countResult, requests] = await Promise.all([
      db
        .select({ total: count(webhookRequests.id) })
        .from(webhookRequests)
        .where(whereClause),
      db
        .select()
        .from(webhookRequests)
        .where(whereClause)
        .orderBy(desc(webhookRequests.receivedAt))
        .limit(limit)
        .offset(offset),
    ]);

    const totalCount = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json(
      {
        requests,
        totalCount,
        page,
        limit,
        totalPages,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error fetching requests:", err);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: endpointId } = await params;
    const isOwner = await verifyEndpointOwnership(endpointId, session.userId);
    if (!isOwner) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    // Strictly scoped bulk deletion for the target endpoint only
    await db
      .delete(webhookRequests)
      .where(eq(webhookRequests.endpointId, endpointId));

    return NextResponse.json({ success: true, endpointId }, { status: 200 });
  } catch (err) {
    console.error("Error clearing requests:", err);
    return NextResponse.json(
      { error: "Failed to clear requests" },
      { status: 500 }
    );
  }
}
