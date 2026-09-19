"use client";

import { useEffect, useRef } from "react";
import { WebhookRequest } from "@/db/schema";

export function useSSE({
  endpointId,
  onNewRequest,
  onReconnect,
}: {
  endpointId: string;
  onNewRequest: (req: WebhookRequest) => void;
  onReconnect?: () => void;
}) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!endpointId) return;

    let reconnectTimer: NodeJS.Timeout;

    function connect() {
      const url = `/api/endpoints/${endpointId}/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("request_created", (event) => {
        try {
          const reqData: WebhookRequest = JSON.parse(event.data);
          onNewRequest(reqData);
        } catch (err) {
          console.error("Error parsing SSE request event:", err);
        }
      });

      es.onerror = () => {
        es.close();
        // Schedule auto-reconnect after 3 seconds
        reconnectTimer = setTimeout(() => {
          connect();
          if (onReconnect) onReconnect();
        }, 3000);
      };
    }

    connect();

    // Trigger sync on tab focus
    function handleFocus() {
      if (onReconnect) onReconnect();
    }
    window.addEventListener("focus", handleFocus);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearTimeout(reconnectTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [endpointId, onNewRequest, onReconnect]);
}
