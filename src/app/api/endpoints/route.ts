import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests } from "@/db/schema";
import { generateEndpointToken } from "@/lib/token";
import { desc, count, max, eq } from "drizzle-orm";

export async function GET() {
  try {
    const endpoints = await db
      .select({
        id: webhookEndpoints.id,
        name: webhookEndpoints.name,
        token: webhookEndpoints.token,
        createdAt: webhookEndpoints.createdAt,
        updatedAt: webhookEndpoints.updatedAt,
        requestCount: count(webhookRequests.id),
        lastRequestAt: max(webhookRequests.receivedAt),
      })
      .from(webhookEndpoints)
      .leftJoin(webhookRequests, eq(webhookEndpoints.id, webhookRequests.endpointId))
      .groupBy(webhookEndpoints.id)
      .orderBy(desc(webhookEndpoints.createdAt));

    return NextResponse.json({ endpoints }, { status: 200 });
  } catch (err) {
    console.error("Error fetching endpoints:", err);
    return NextResponse.json(
      { error: "Failed to fetch endpoints" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Endpoint";

    const token = generateEndpointToken();

    const [newEndpoint] = await db
      .insert(webhookEndpoints)
      .values({
        name,
        token,
      })
      .returning();

    return NextResponse.json({ endpoint: newEndpoint }, { status: 201 });
  } catch (err) {
    console.error("Error creating endpoint:", err);
    return NextResponse.json(
      { error: "Failed to create endpoint" },
      { status: 500 }
    );
  }
}
