import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateReplayUrl } from "@/lib/ssrf";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const body = await req.json().catch(() => ({}));
    const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : "";

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Target URL is required for replay" },
        { status: 400 }
      );
    }

    // 1. SSRF Security Check
    const validation = await validateReplayUrl(targetUrl);
    if (!validation.valid || !validation.url) {
      return NextResponse.json(
        { error: `SSRF Validation Failed: ${validation.reason}` },
        { status: 400 }
      );
    }

    // 2. Lookup Original Captured Request
    const originalRequest = await db.query.webhookRequests.findFirst({
      where: eq(webhookRequests.id, requestId),
    });

    if (!originalRequest) {
      return NextResponse.json(
        { error: "Original request not found" },
        { status: 404 }
      );
    }

    // 3. Prepare Replay Request Options
    const headers = new Headers();
    if (originalRequest.headers) {
      Object.entries(originalRequest.headers).forEach(([k, v]) => {
        // Exclude host or connection headers
        const lowerK = k.toLowerCase();
        if (lowerK !== "host" && lowerK !== "content-length" && lowerK !== "connection") {
          headers.set(k, v);
        }
      });
    }

    headers.set("X-WebhookLab-Replay", "true");

    let reqBody: string | undefined = undefined;
    if (originalRequest.method !== "GET" && originalRequest.method !== "HEAD") {
      reqBody = originalRequest.rawBody || undefined;
    }

    // 4. Send Replay Request with Timeout & Manual Redirect Protection
    const startTime = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let res: Response;
    try {
      res = await fetch(validation.url.toString(), {
        method: originalRequest.method,
        headers,
        body: reqBody,
        redirect: "manual", // Prevent unverified redirects to private networks
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      return NextResponse.json(
        {
          error: `Replay HTTP dispatch failed: ${(fetchErr as Error).message}`,
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    const duration = Math.round(performance.now() - startTime);

    // 5. Read Response Metadata & Body
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    let resBody = "";
    try {
      resBody = await res.text();
      // Cap response snippet to 50 KB
      if (resBody.length > 51200) {
        resBody = resBody.slice(0, 51200) + "\n...[truncated]";
      }
    } catch {
      resBody = "[Unable to read response body]";
    }

    return NextResponse.json({
      replay: {
        targetUrl,
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: resBody,
        duration,
      },
    });
  } catch (err) {
    console.error("Error replaying request:", err);
    return NextResponse.json(
      { error: "Failed to execute request replay" },
      { status: 500 }
    );
  }
}
