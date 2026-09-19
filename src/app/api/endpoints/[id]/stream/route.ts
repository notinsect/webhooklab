import { NextRequest } from "next/server";
import { sseBus } from "@/lib/sse";
import { WebhookRequest } from "@/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: endpointId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode(": connected\n\n"));

      const listener = (eventPayload: { type: string; data: WebhookRequest }) => {
        try {
          const chunk = `event: ${eventPayload.type}\ndata: ${JSON.stringify(eventPayload.data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch (err) {
          console.error("SSE enqueue error:", err);
        }
      };

      // Register SSE Bus listener
      sseBus.on(`endpoint:${endpointId}`, listener);

      // Heartbeat ping interval to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        sseBus.off(`endpoint:${endpointId}`, listener);
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
