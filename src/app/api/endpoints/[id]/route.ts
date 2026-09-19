import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const endpoint = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, id),
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ endpoint }, { status: 200 });
  } catch (err) {
    console.error("Error fetching endpoint:", err);
    return NextResponse.json(
      { error: "Failed to fetch endpoint" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id }, { status: 200 });
  } catch (err) {
    console.error("Error deleting endpoint:", err);
    return NextResponse.json(
      { error: "Failed to delete endpoint" },
      { status: 500 }
    );
  }
}
