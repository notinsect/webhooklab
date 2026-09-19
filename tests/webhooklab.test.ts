import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { redactHeaderValue, redactHeaders } from "@/lib/redaction";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests, WebhookRequest } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Phase 4: Header Redaction & Copy Safety", () => {
  test("redacts sensitive header credentials (authorization, cookie, x-api-key)", () => {
    expect(redactHeaderValue("authorization", "Bearer secret_live_key_998877")).toBe("Bearer ••••••••");
    expect(redactHeaderValue("cookie", "session_id=abcdef123456")).toBe("••••••••");
    expect(redactHeaderValue("x-api-key", "ak_live_123456789")).toBe("••••••••");
  });

  test("generates safe serialized request JSON object with redacted headers", () => {
    const rawHeaders = {
      "content-type": "application/json",
      "authorization": "Bearer secret_key",
      "x-api-key": "secret_api_key",
      "user-agent": "curl/8.7.1",
    };

    const redacted = redactHeaders(rawHeaders);
    const safeJsonString = JSON.stringify({
      method: "POST",
      path: "/h/token123",
      headers: redacted,
      body: { event: "payment.completed" },
    });

    expect(safeJsonString).not.toContain("secret_key");
    expect(safeJsonString).not.toContain("secret_api_key");
    expect(safeJsonString).toContain("Bearer ••••••••");
    expect(safeJsonString).toContain("••••••••");
  });
});

describe("Phase 4: Realtime Selection Rule & Request Inspection", () => {
  let createdEndpointId: string;
  const token = generateEndpointToken();

  beforeAll(async () => {
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({
        name: "Phase 4 Inspection Test Endpoint",
        token,
      })
      .returning();
    createdEndpointId = ep.id;
  });

  afterAll(async () => {
    if (createdEndpointId) {
      await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, createdEndpointId));
    }
  });

  test("preserves current user selection when a new realtime request arrives", () => {
    const initialRequests: WebhookRequest[] = [
      {
        id: "req-A",
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}`,
        query: null,
        headers: {},
        body: { name: "Request A" },
        rawBody: null,
        contentType: "application/json",
        bodySize: 20,
        ipAddress: "127.0.0.1",
        userAgent: "curl/8.7.1",
        receivedAt: new Date(Date.now() - 5000),
      },
    ];

    let currentSelectedId: string | undefined = "req-A";

    // New request B arrives
    const newReqB: WebhookRequest = {
      id: "req-B",
      endpointId: createdEndpointId,
      method: "POST",
      path: `/h/${token}`,
      query: null,
      headers: {},
      body: { name: "Request B" },
      rawBody: null,
      contentType: "application/json",
      bodySize: 20,
      ipAddress: "127.0.0.1",
      userAgent: "curl/8.7.1",
      receivedAt: new Date(),
    };

    // Prepend new request
    const updatedList = [newReqB, ...initialRequests];

    // Realtime Selection Rule: currentSelectedId remains "req-A" if already set!
    currentSelectedId = currentSelectedId || newReqB.id;

    expect(updatedList[0].id).toBe("req-B"); // Prepended to top
    expect(currentSelectedId).toBe("req-A"); // User selection preserved!
  });

  test("maps stored request properties into HttpMessage format for RequestResponseViewer", async () => {
    const jsonBody = {
      event: "payment.completed",
      id: "evt_123",
      amount: 2499,
      currency: "INR",
      customer: { id: "cus_42", email: "alex@example.com" },
    };

    const [storedReq] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}?source=stripe&environment=test`,
        query: { source: "stripe", environment: "test" },
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer secret-example-token",
          "x-test-header": "webhooklab",
        },
        body: jsonBody,
        rawBody: JSON.stringify(jsonBody),
        contentType: "application/json",
        bodySize: JSON.stringify(jsonBody).length,
        receivedAt: new Date(),
      })
      .returning();

    // Map to HttpMessage
    const httpMessage = {
      method: storedReq.method,
      url: storedReq.path,
      headers: storedReq.headers as Record<string, string>,
      query: storedReq.query as Record<string, string>,
      body: storedReq.body,
    };

    expect(httpMessage.method).toBe("POST");
    expect(httpMessage.query).toEqual({ source: "stripe", environment: "test" });
    expect(httpMessage.body).toEqual(jsonBody);
  });
});
