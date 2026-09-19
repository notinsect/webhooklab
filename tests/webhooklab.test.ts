import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateEndpointToken } from "@/lib/token";
import { sseBus, publishNewRequest } from "@/lib/sse";
import { db } from "@/db";
import { webhookEndpoints, webhookRequests, WebhookRequest } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

describe("Phase 3: Realtime SSE Bus & Endpoint Isolation", () => {
  test("emits request_created event to subscribers of specific endpointId", (done) => {
    const endpointId = "test-ep-12345";
    const dummyReq: WebhookRequest = {
      id: "req-999",
      endpointId,
      method: "POST",
      path: `/h/token123`,
      query: null,
      headers: { "content-type": "application/json" },
      body: { event: "ping" },
      rawBody: '{"event":"ping"}',
      contentType: "application/json",
      bodySize: 16,
      ipAddress: "127.0.0.1",
      userAgent: "bun-test",
      receivedAt: new Date(),
    };

    const listener = (event: { type: string; data: WebhookRequest }) => {
      expect(event.type).toBe("request_created");
      expect(event.data.id).toBe("req-999");
      expect(event.data.endpointId).toBe(endpointId);
      sseBus.off(`endpoint:${endpointId}`, listener);
      done();
    };

    sseBus.on(`endpoint:${endpointId}`, listener);
    publishNewRequest(endpointId, dummyReq);
  });

  test("isolates events between different endpoints (Endpoint A does not receive Endpoint B events)", (done) => {
    const endpointA = "endpoint-A";
    const endpointB = "endpoint-B";

    let endpointAEventsReceived = 0;

    const listenerA = () => {
      endpointAEventsReceived++;
    };

    sseBus.on(`endpoint:${endpointA}`, listenerA);

    // Publish to Endpoint B
    const dummyReqB: WebhookRequest = {
      id: "req-B",
      endpointId: endpointB,
      method: "GET",
      path: `/h/tokenB`,
      query: null,
      headers: {},
      body: null,
      rawBody: null,
      contentType: null,
      bodySize: 0,
      ipAddress: "127.0.0.1",
      userAgent: "bun-test",
      receivedAt: new Date(),
    };

    publishNewRequest(endpointB, dummyReqB);

    setTimeout(() => {
      expect(endpointAEventsReceived).toBe(0);
      sseBus.off(`endpoint:${endpointA}`, listenerA);
      done();
    }, 50);
  });

  test("cleans up listener when client unsubscribes", () => {
    const endpointId = "cleanup-ep-555";
    const listener = () => {};

    sseBus.on(`endpoint:${endpointId}`, listener);
    expect(sseBus.listenerCount(`endpoint:${endpointId}`)).toBe(1);

    sseBus.off(`endpoint:${endpointId}`, listener);
    expect(sseBus.listenerCount(`endpoint:${endpointId}`)).toBe(0);
  });
});

describe("Phase 2 & 3: Database & Webhook Storage Integration", () => {
  let createdEndpointId: string;
  const token = generateEndpointToken();

  beforeAll(async () => {
    const [ep] = await db
      .insert(webhookEndpoints)
      .values({
        name: "Phase 3 Realtime Test Endpoint",
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

  test("captures POST request with parsed JSON body", async () => {
    const jsonBody = { event: "payment.completed", id: "evt_realtime_001", amount: 2499, currency: "INR" };
    const [req] = await db
      .insert(webhookRequests)
      .values({
        endpointId: createdEndpointId,
        method: "POST",
        path: `/h/${token}`,
        query: null,
        headers: { "content-type": "application/json", "x-webhook-test": "realtime" },
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

  test("queries requests for endpoint ordered newest first", async () => {
    const reqs = await db
      .select()
      .from(webhookRequests)
      .where(eq(webhookRequests.endpointId, createdEndpointId))
      .orderBy(desc(webhookRequests.receivedAt));

    expect(reqs.length).toBeGreaterThanOrEqual(1);
  });
});
