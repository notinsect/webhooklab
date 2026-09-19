import { NextRequest } from "next/server";
import { sseBus } from "@/lib/sse";
import { WebhookRequest } from "@/db/schema";
import { getSessionUser, verifyEndpointOwnership } from "@/lib/auth";
import { redactHeaders } from "@/lib/redaction";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: endpointId } = await params;
  const isOwner = await verifyEndpointOwnership(endpointId, session.userId);
  if (!isOwner) {
    return new Response("Endpoint not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode(": connected\n\n"));

      const listener = (eventPayload: { type: string; data: WebhookRequest }) => {
        try {
          const safeData = {
            ...eventPayload.data,
            headers: redactHeaders((eventPayload.data.headers as Record<string, string>) || {}),
          };
          const chunk = `event: ${eventPayload.type}\ndata: ${JSON.stringify(safeData)}\n\n`;
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
