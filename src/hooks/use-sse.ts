"use client";

import { useEffect, useState, useRef } from "react";
import { WebhookRequest } from "@/db/schema";

export type SSEStatus = "connecting" | "live" | "reconnecting";

export function useSSE({
  endpointId,
  onNewRequest,
  onReconnect,
}: {
  endpointId: string;
  onNewRequest: (req: WebhookRequest) => void;
  onReconnect?: () => void;
}) {
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!endpointId) return;

    let reconnectTimer: NodeJS.Timeout;

    function connect() {
      const url = `/api/endpoints/${endpointId}/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("live");
      };

      es.addEventListener("request_created", (event) => {
        try {
          const reqData: WebhookRequest = JSON.parse(event.data);
          onNewRequest(reqData);
        } catch (err) {
          console.error("Error parsing SSE request event:", err);
        }
      });

      es.onerror = () => {
        setStatus("reconnecting");
        es.close();
        reconnectTimer = setTimeout(() => {
          connect();
          if (onReconnect) onReconnect();
        }, 3000);
      };
    }

    connect();

    // Trigger state sync on window focus
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

  return { status };
}
