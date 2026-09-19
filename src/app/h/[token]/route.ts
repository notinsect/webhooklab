import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { publishNewRequest } from "@/lib/sse";

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1 MB limit

async function handleWebhookIngestion(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // 1. Resolve endpoint by token
  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.token, token),
  });

  if (!endpoint) {
    return NextResponse.json(
      { error: "Webhook endpoint not found" },
      { status: 404 }
    );
  }

  // 2. Content-Length Header check
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: "Payload exceeds maximum size limit of 1MB" },
        { status: 413 }
      );
    }
  }

  // 3. Read Body & Measure Size
  let rawBody = "";
  let bodySize = 0;
  let parsedBody: unknown = null;

  try {
    const arrayBuffer = await req.arrayBuffer();
    bodySize = arrayBuffer.byteLength;

    if (bodySize > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: "Payload exceeds maximum size limit of 1MB" },
        { status: 413 }
      );
    }

    if (bodySize > 0) {
      const decoder = new TextDecoder("utf-8");
      rawBody = decoder.decode(arrayBuffer);
    }
  } catch (err) {
    console.error("Error reading request body:", err);
  }

  // 4. Parse Body (JSON, form-urlencoded, or text)
  const contentType = req.headers.get("content-type") || "";

  if (rawBody) {
    if (contentType.includes("application/json")) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        // Malformed JSON: preserve rawBody string safely, set parsedBody to null
        parsedBody = null;
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const searchParams = new URLSearchParams(rawBody);
        const formObj: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          formObj[key] = value;
        });
        parsedBody = formObj;
      } catch {
        parsedBody = null;
      }
    }
  }

  // 5. Capture Headers & Query Parameters
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key.toLowerCase()] = value;
  });

  const queryObj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    queryObj[key] = value;
  });

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || undefined;

  // 6. Save Request to PostgreSQL
  const [newRequest] = await db
    .insert(webhookRequests)
    .values({
      endpointId: endpoint.id,
      method: req.method.toUpperCase(),
      path: req.nextUrl.pathname + req.nextUrl.search,
      query: Object.keys(queryObj).length > 0 ? queryObj : null,
      headers: headersObj,
      body: parsedBody,
      rawBody: rawBody || null,
      contentType: contentType || null,
      bodySize,
      ipAddress,
      userAgent,
      receivedAt: new Date(),
    })
    .returning();

  // 7. Publish Realtime SSE Event
  publishNewRequest(endpoint.id, newRequest);

  // 8. Return 200 OK Response
  return NextResponse.json(
    { received: true },
    { status: 200 }
  );
}

export const GET = handleWebhookIngestion;
export const POST = handleWebhookIngestion;
export const PUT = handleWebhookIngestion;
export const PATCH = handleWebhookIngestion;
export const DELETE = handleWebhookIngestion;
