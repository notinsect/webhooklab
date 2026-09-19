import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { eq } from "drizzle-orm";

async function handleWebhookPlaceholder(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Validate that token exists
  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.token, token),
  });

  if (!endpoint) {
    return NextResponse.json(
      { error: "Webhook endpoint not found" },
      { status: 404 }
    );
  }

  // Valid token placeholder response for Phase 1
  return NextResponse.json(
    {
      status: "active",
      endpointId: endpoint.id,
      message: "Webhook endpoint is active. Webhook ingestion implementation comes in Phase 2.",
    },
    { status: 200 }
  );
}

export const GET = handleWebhookPlaceholder;
export const POST = handleWebhookPlaceholder;
export const PUT = handleWebhookPlaceholder;
export const PATCH = handleWebhookPlaceholder;
export const DELETE = handleWebhookPlaceholder;
