import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    const [deleted] = await db
      .delete(webhookRequests)
      .where(eq(webhookRequests.id, requestId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: requestId }, { status: 200 });
  } catch (err) {
    console.error("Error deleting request:", err);
    return NextResponse.json(
      { error: "Failed to delete request" },
      { status: 500 }
    );
  }
}
