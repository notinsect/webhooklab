import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookRequests, webhookEndpoints } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;

    // Join with webhookEndpoints to verify user ownership
    const [requestItem] = await db
      .select({
        requestId: webhookRequests.id,
        endpointUserId: webhookEndpoints.userId,
      })
      .from(webhookRequests)
      .innerJoin(webhookEndpoints, eq(webhookRequests.endpointId, webhookEndpoints.id))
      .where(and(eq(webhookRequests.id, requestId), eq(webhookEndpoints.userId, session.userId)))
      .limit(1);

    if (!requestItem) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    const [deleted] = await db
      .delete(webhookRequests)
      .where(eq(webhookRequests.id, requestId))
      .returning();

    return NextResponse.json({ success: true, deletedId: deleted.id }, { status: 200 });
  } catch (err) {
    console.error("Error deleting request:", err);
    return NextResponse.json(
      { error: "Failed to delete request" },
      { status: 500 }
    );
  }
}
