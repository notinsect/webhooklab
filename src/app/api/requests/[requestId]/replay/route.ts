import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookRequests, webhookEndpoints, webhookReplays } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { validateReplayUrl } from "@/lib/ssrf";
import { executeReplay, sanitizeReplayHeaders } from "@/lib/replay";
import { redactHeaders } from "@/lib/redaction";
import { checkRateLimit } from "@/lib/ratelimit";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await req.json().catch(() => ({}));
    const { destinationUrl } = body || {};

    if (!destinationUrl || typeof destinationUrl !== "string") {
      return NextResponse.json(
        { error: "Target destination URL is required for replay." },
        { status: 400 }
      );
    }

    // 1. Replay Rate Limiting (10 replays / minute per user)
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const rateLimit = await checkRateLimit(`replay:${session.userId}`, ipAddress);
    if (!rateLimit.allowed) {
      const res = NextResponse.json(
        { error: "Replay rate limit exceeded. Please wait before retrying." },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(rateLimit.retryAfter));
      return res;
    }

    // 2. Fetch Captured Request & Verify User Ownership
    const [requestItem] = await db
      .select({
        request: webhookRequests,
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

    const capturedRequest = requestItem.request;

    // 3. Validate Destination URL against SSRF Safeguards
    const validation = await validateReplayUrl(destinationUrl);
    if (!validation.valid || !validation.url) {
      return NextResponse.json(
        { error: validation.reason || "This destination cannot be used for security reasons." },
        { status: 400 }
      );
    }

    // 4. Execute Outbound Replay
    const result = await executeReplay(capturedRequest, destinationUrl);

    // 5. Redact Response Headers for safe storage and display
    const safeResponseHeaders = redactHeaders(result.headers);

    // 6. Persist Replay Audit Trail in PostgreSQL
    const [replayRecord] = await db
      .insert(webhookReplays)
      .values({
        requestId: capturedRequest.id,
        userId: session.userId,
        destinationUrl: validation.url.toString(),
        method: capturedRequest.method,
        status: result.status,
        statusText: result.statusText,
        durationMs: result.durationMs,
        responseHeaders: safeResponseHeaders,
        responseBody: result.body,
        responseSize: result.bodySize,
        error: result.error,
        createdAt: new Date(),
      })
      .returning();

    // 7. Format Payload for Varnus RequestResponseViewer
    const outboundHeaders = {
      "User-Agent": "WebhookLab-Replay/0.1",
      ...sanitizeReplayHeaders((capturedRequest.headers as Record<string, string>) || {}),
    };

    return NextResponse.json(
      {
        success: true,
        replay: {
          id: replayRecord.id,
          destinationUrl: validation.url.toString(),
          method: capturedRequest.method,
          status: result.status,
          statusText: result.statusText,
          durationMs: result.durationMs,
          error: result.error,
          request: {
            method: capturedRequest.method,
            url: validation.url.toString(),
            headers: outboundHeaders,
            body: capturedRequest.body || capturedRequest.rawBody,
          },
          response: result.status
            ? {
                status: result.status,
                statusText: result.statusText || "",
                headers: safeResponseHeaders,
                body: result.body,
              }
            : null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error executing request replay:", err);
    return NextResponse.json(
      { error: "An unexpected internal error occurred during request replay." },
      { status: 500 }
    );
  }
}
