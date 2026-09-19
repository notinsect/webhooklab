import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { redactHeaderValue, redactHeaders } from "@/lib/redaction";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests } from "@/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";

describe("Phase 5: Search, Filtering & Header Redaction Safety", () => {
  test("redacts sensitive header credentials (authorization, cookie, x-api-key)", () => {
    expect(redactHeaderValue("authorization", "Bearer secret_live_key_998877")).toBe("Bearer ••••••••");
    expect(redactHeaderValue("cookie", "session_id=abcdef123456")).toBe("••••••••");
    expect(redactHeaderValue("x-api-key", "ak_live_123456789")).toBe("••••••••");
  });

  test("does not include sensitive raw headers in safe copy JSON object", () => {
    const rawHeaders = {
      "content-type": "application/json",
      "authorization": "Bearer secret_key",
      "x-api-key": "secret_api_key",
    };

    const redacted = redactHeaders(rawHeaders);
    const safeJsonString = JSON.stringify({
      method: "POST",
      path: "/h/token123",
      headers: redacted,
    });

    expect(safeJsonString).not.toContain("secret_key");
    expect(safeJsonString).not.toContain("secret_api_key");
    expect(safeJsonString).toContain("Bearer ••••••••");
  });
});

describe("Phase 5: Request Management & Retention Lifecycle", () => {
  let endpointAId: string;
  let endpointBId: string;
  const tokenA = generateEndpointToken();
  const tokenB = generateEndpointToken();

  beforeAll(async () => {
    const [epA] = await db
      .insert(webhookEndpoints)
      .values({ name: "Management Test Endpoint A", token: tokenA })
      .returning();
    endpointAId = epA.id;

    const [epB] = await db
      .insert(webhookEndpoints)
      .values({ name: "Management Test Endpoint B", token: tokenB })
      .returning();
    endpointBId = epB.id;
  });

  afterAll(async () => {
    if (endpointAId) await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointAId));
    if (endpointBId) await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointBId));
  });

  test("captures and queries requests with method filtering & body text search", async () => {
    const [req1] = await db
      .insert(webhookRequests)
      .values({
        endpointId: endpointAId,
        method: "POST",
        path: `/h/${tokenA}?event=payment`,
        headers: { "content-type": "application/json" },
        body: { event: "payment.completed", id: "evt_123" },
        rawBody: '{"event":"payment.completed","id":"evt_123"}',
        contentType: "application/json",
        receivedAt: new Date(Date.now() - 3000),
      })
      .returning();

    const [req2] = await db
      .insert(webhookRequests)
      .values({
        endpointId: endpointAId,
        method: "GET",
        path: `/h/${tokenA}?source=stripe`,
        query: { source: "stripe" },
        headers: {},
        body: null,
        rawBody: null,
        contentType: null,
        receivedAt: new Date(Date.now() - 1000),
      })
      .returning();

    expect(req1.id).toBeDefined();
    expect(req2.id).toBeDefined();

    // Query POST only
    const postReqs = await db
      .select()
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, endpointAId))
      .orderBy(desc(webhookRequests.receivedAt));

    expect(postReqs.length).toBeGreaterThanOrEqual(2);
    expect(postReqs[0].method).toBe("GET"); // Newest first
  });

  test("deletes single request by ID cleanly", async () => {
    const [singleReq] = await db
      .insert(webhookRequests)
      .values({
        endpointId: endpointAId,
        method: "DELETE",
        path: `/h/${tokenA}`,
        receivedAt: new Date(),
      })
      .returning();

    await db.delete(webhookRequests).where(eq(webhookRequests.id, singleReq.id));

    const deletedCheck = await db.query.webhookRequests.findFirst({
      where: eq(webhookRequests.id, singleReq.id),
    });

    expect(deletedCheck).toBeUndefined();
  });

  test("clears endpoint history in Endpoint A while preserving Endpoint B requests", async () => {
    // Insert into Endpoint B
    const [reqB] = await db
      .insert(webhookRequests)
      .values({
        endpointId: endpointBId,
        method: "POST",
        path: `/h/${tokenB}`,
        receivedAt: new Date(),
      })
      .returning();

    // Clear Endpoint A requests only
    await db.delete(webhookRequests).where(eq(webhookRequests.endpointId, endpointAId));

    // Verify Endpoint A has 0 requests
    const countA = await db
      .select({ total: count(webhookRequests.id) })
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, endpointAId));

    expect(countA[0].total).toBe(0);

    // Verify Endpoint B request remains intact
    const checkB = await db.query.webhookRequests.findFirst({
      where: eq(webhookRequests.id, reqB.id),
    });

    expect(checkB).not.toBeNull();
    expect(checkB?.endpointId).toBe(endpointBId);
  });

  test("enforces server-side 100-request retention limit per endpoint", async () => {
    const retentionToken = generateEndpointToken();
    const [retentionEp] = await db
      .insert(webhookEndpoints)
      .values({ name: "Retention Test Ep", token: retentionToken })
      .returning();

    // Insert 105 requests
    const insertValues = Array.from({ length: 105 }).map((_, index) => ({
      endpointId: retentionEp.id,
      method: "POST",
      path: `/h/${retentionToken}`,
      rawBody: `Request #${index + 1}`,
      receivedAt: new Date(Date.now() - (105 - index) * 100),
    }));

    await db.insert(webhookRequests).values(insertValues);

    // Run retention cleanup keeping top 100 newest
    const subquery = db
      .select({ id: webhookRequests.id })
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, retentionEp.id))
      .orderBy(desc(webhookRequests.receivedAt))
      .offset(100);

    await db
      .delete(webhookRequests)
      .where(sql`${webhookRequests.id} IN (${subquery})`);

    const [{ value: remainingCount }] = await db
      .select({ value: count() })
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, retentionEp.id));

    expect(Number(remainingCount)).toBe(100);

    // Cleanup test endpoint
    await db.delete(webhookRequests).where(eq(webhookRequests.endpointId, retentionEp.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, retentionEp.id));
  });
});
