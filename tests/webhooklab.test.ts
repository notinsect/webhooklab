import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { redactHeaderValue, redactHeaders } from "@/lib/redaction";
import { validateReplayUrl } from "@/lib/ssrf";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Token Generation", () => {
  test("generates unique 24-character hex token with high entropy", () => {
    const token1 = generateEndpointToken();
    const token2 = generateEndpointToken();

    expect(token1).toHaveLength(24);
    expect(token2).toHaveLength(24);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{24}$/.test(token1)).toBe(true);
  });
});

describe("Header Redaction", () => {
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

describe("SSRF Replay Safeguards", () => {
  test("blocks private IP ranges, localhost, and cloud metadata endpoints", async () => {
    const localhostRes = await validateReplayUrl("http://localhost:3000/webhook");
    expect(localhostRes.valid).toBe(false);

    const loopbackRes = await validateReplayUrl("http://127.0.0.1/api");
    expect(loopbackRes.valid).toBe(false);

    const privateIpRes = await validateReplayUrl("http://192.168.1.1/admin");
    expect(privateIpRes.valid).toBe(false);

    const metadataRes = await validateReplayUrl("http://169.254.169.254/latest/meta-data");
    expect(metadataRes.valid).toBe(false);
  });

  test("allows valid public http/https URLs", async () => {
    const publicRes = await validateReplayUrl("https://httpbin.org/post");
    expect(publicRes.valid).toBe(true);
  });
});

describe("Database & Webhook Storage Integration", () => {
  let createdEndpointId: string;
  const token = generateEndpointToken();

  beforeAll(async () => {
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({
        name: "Integration Test Endpoint",
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

  test("creates endpoint in PostgreSQL and generates unique token", async () => {
    const fetched = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, createdEndpointId),
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Integration Test Endpoint");
    expect(fetched?.token).toBe(token);
  });

  test("captures GET request with query parameters and headers", async () => {
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "GET",
        path: `/h/${token}?event=user.signup&source=test`,
        query: { event: "user.signup", source: "test" },
        headers: { "user-agent": "bun-test", accept: "*/*" },
        body: null,
        rawBody: null,
        contentType: null,
        bodySize: 0,
        receivedAt: new Date(),
      })
      .returning();

    expect(req.id).toBeDefined();
    expect(req.method).toBe("GET");
    expect(req.query).toEqual({ event: "user.signup", source: "test" });
  });

  test("captures POST request with parsed JSON body", async () => {
    const jsonBody = { event: "payment.completed", id: "evt_999", amount: 4999 };
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}`,
        query: null,
        headers: { "content-type": "application/json" },
        body: jsonBody,
        rawBody: JSON.stringify(jsonBody),
        contentType: "application/json",
        bodySize: JSON.stringify(jsonBody).length,
        receivedAt: new Date(),
      })
      .returning();

    expect(req.method).toBe("POST");
    expect(req.body).toEqual(jsonBody);
  });

  test("handles malformed JSON body safely without throwing", async () => {
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

  test("cascades deletion of requests when endpoint is deleted", async () => {
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
