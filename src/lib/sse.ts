import { EventEmitter } from "events";
import { WebhookRequest } from "@/db/schema";

class SSEEventBus extends EventEmitter {}

// Use global singleton so hot module reloading doesn't lose listeners in dev mode
const globalForSSE = globalThis as unknown as {
  sseBus: SSEEventBus | undefined;
};

export const sseBus = globalForSSE.sseBus ?? new SSEEventBus();
if (process.env.NODE_ENV !== "production") globalForSSE.sseBus = sseBus;

export function publishNewRequest(endpointId: string, request: WebhookRequest) {
  sseBus.emit(`endpoint:${endpointId}`, {
    type: "request_created",
    data: request,
  });
}
