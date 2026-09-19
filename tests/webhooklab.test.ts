import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { redactHeaderValue, redactHeaders } from "@/lib/redaction";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

describe("Phase 2: Header Redaction Utility", () => {
  test("redacts sensitive headers (authorization, cookie, x-api-key)", () => {
    expect(redactHeaderValue("authorization", "Bearer secret_jwt_token")).toBe("Bearer ••••••••");
    expect(redactHeaderValue("cookie", "session_id=12345")).toBe("••••••••");
    expect(redactHeaderValue("x-api-key", "ak_live_9988776655")).toBe("••••••••");
    expect(redactHeaderValue("content-type", "application/json")).toBe("application/json");
  });

  test("redacts entire header object safely", () => {
    const rawHeaders = {
      "content-type": "application/json",
      "authorization": "Bearer secret_xyz",
      "x-api-key": "secret123",
      "user-agent": "curl/7.88.1",
    };

    const redacted = redactHeaders(rawHeaders);
    expect(redacted["content-type"]).toBe("application/json");
    expect(redacted["authorization"]).toBe("Bearer ••••••••");
    expect(redacted["x-api-key"]).toBe("••••••••");
    expect(redacted["user-agent"]).toBe("curl/7.88.1");
  });
});

describe("Phase 2: Webhook Request Capture & Persistence", () => {
  let createdEndpointId: string;
  const token = generateEndpointToken();

  beforeAll(async () => {
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({
        name: "Phase 2 Integration Endpoint",
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

  test("captures GET request with query parameters and headers", async () => {
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "GET",
        path: `/h/${token}?source=test&mode=development`,
        query: { source: "test", mode: "development" },
        headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
        body: null,
        rawBody: null,
        contentType: null,
        bodySize: 0,
        receivedAt: new Date(Date.now() - 2000),
      })
      .returning();

    expect(req.id).toBeDefined();
    expect(req.method).toBe("GET");
    expect(req.query).toEqual({ source: "test", mode: "development" });
    expect(req.bodySize).toBe(0);
  });

  test("captures POST request with parsed JSON body", async () => {
    const jsonBody = { event: "payment.completed", id: "evt_123", amount: 2499, currency: "INR" };
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}`,
        query: null,
        headers: { "content-type": "application/json", "x-webhook-test": "active" },
        body: jsonBody,
        rawBody: JSON.stringify(jsonBody),
        contentType: "application/json",
        bodySize: JSON.stringify(jsonBody).length,
        receivedAt: new Date(Date.now() - 1000),
      })
      .returning();

    expect(req.method).toBe("POST");
    expect(req.body).toEqual(jsonBody);
    expect((req.headers as Record<string, string>)["x-webhook-test"]).toBe("active");
  });

  test("captures plain text body request", async () => {
    const textBody = "hello webhooklab";
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}`,
        headers: { "content-type": "text/plain" },
        body: null,
        rawBody: textBody,
        contentType: "text/plain",
        bodySize: textBody.length,
        receivedAt: new Date(),
      })
      .returning();

    expect(req.method).toBe("POST");
    expect(req.contentType).toBe("text/plain");
    expect(req.rawBody).toBe(textBody);
  });

  test("handles malformed JSON body safely without crashing", async () => {
    const malformedStr = '{"event": "broken", invalid}';
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}`,
        headers: { "content-type": "application/json" },
        body: null,
        rawBody: malformedStr,
        contentType: "application/json",
        bodySize: malformedStr.length,
        receivedAt: new Date(),
      })
      .returning();

    expect(req.body).toBeNull();
    expect(req.rawBody).toBe(malformedStr);
  });

  test("queries requests for endpoint ordered newest first", async () => {
    const reqs = await db
      .select()
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, createdEndpointId))
      .orderBy(desc(webhookRequests.receivedAt));

    expect(reqs.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < reqs.length - 1; i++) {
      const current = new Date(reqs[i].receivedAt).getTime();
      const next = new Date(reqs[i + 1].receivedAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  test("cascades deletion of captured requests when endpoint is deleted", async () => {
    const tempToken = generateEndpointToken();
    const [tempEp] = await db
      .insert(webhookEndpoints)
      .values({ name: "Temp Ep", token: tempToken })
      .returning();

    await db.insert(webhookRequests).values({
      endpointId: tempEp.id,
      method: "POST",
      path: `/h/${tempToken}`,
      receivedAt: new Date(),
    });

    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, tempEp.id));

    const remainingReqs = await db.query.webhookRequests.findMany({
      where: eq(webhookRequests.endpointId, tempEp.id),
    });

    expect(remainingReqs).toHaveLength(0);
  });
});
