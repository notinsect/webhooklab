import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { publishNewRequest } from "@/lib/sse";
import { checkRateLimit } from "@/lib/ratelimit";

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1 MB limit
const MAX_REQUESTS_PER_ENDPOINT = 100; // Retention limit
const MAX_HEADER_COUNT = 100;
const MAX_HEADER_VALUE_LENGTH = 8192; // 8KB per header
const MAX_QUERY_COUNT = 50;
const MAX_QUERY_VALUE_LENGTH = 2048; // 2KB per query param

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

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  // 2. Multi-instance Rate Limit Check
  const rateLimitStatus = await checkRateLimit(token, ipAddress);
  if (!rateLimitStatus.allowed) {
    const res = NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(rateLimitStatus.retryAfter));
    return res;
  }

  // 3. Content-Length Header check
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

  // 4. Read Body & Measure Size
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

  // 5. Parse Body (JSON, form-urlencoded, or text)
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
          if (Object.keys(formObj).length < 50) {
            formObj[key.slice(0, 256)] = value.slice(0, 4096);
          }
        });
        parsedBody = formObj;
      } catch {
        parsedBody = null;
      }
    }
  }

  // 6. Capture Headers with limits
  const headersObj: Record<string, string> = {};
  let headerCount = 0;
  req.headers.forEach((value, key) => {
    if (headerCount < MAX_HEADER_COUNT) {
      headersObj[key.toLowerCase()] = value.slice(0, MAX_HEADER_VALUE_LENGTH);
      headerCount++;
    }
  });

  // 7. Capture Query Parameters with limits
  const queryObj: Record<string, string> = {};
  let queryCount = 0;
  req.nextUrl.searchParams.forEach((value, key) => {
    if (queryCount < MAX_QUERY_COUNT) {
      queryObj[key.slice(0, 256)] = value.slice(0, MAX_QUERY_VALUE_LENGTH);
      queryCount++;
    }
  });

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) || undefined;

  // 8. Save Request to PostgreSQL
  const [newRequest] = await db
    .insert(webhookRequests)
    .values({
      endpointId: endpoint.id,
      method: req.method.toUpperCase(),
      path: (req.nextUrl.pathname + req.nextUrl.search).slice(0, 2048),
      query: Object.keys(queryObj).length > 0 ? queryObj : null,
      headers: headersObj,
      body: parsedBody,
      rawBody: rawBody || null,
      contentType: contentType ? contentType.slice(0, 256) : null,
      bodySize,
      ipAddress,
      userAgent,
      receivedAt: new Date(),
    })
    .returning();

  // 9. Enforce Server-Side Retention Policy (Keep latest 100 requests per endpoint)
  try {
    const subquery = db
      .select({ id: webhookRequests.id })
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, endpoint.id))
      .orderBy(desc(webhookRequests.receivedAt))
      .offset(MAX_REQUESTS_PER_ENDPOINT);

    await db
      .delete(webhookRequests)
      .where(sql`${webhookRequests.id} IN (${subquery})`);
  } catch (err) {
    console.error("Error running request retention cleanup:", err);
  }

  // 10. Publish Realtime SSE Event
  publishNewRequest(endpoint.id, newRequest);

  // 11. Return 200 OK Response
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
