"use client";

import { CopyButton } from "./copy-button";
import { Terminal, RefreshCw } from "lucide-react";

export function EmptyState({ webhookUrl }: { webhookUrl: string }) {
  const curlExample = `curl -i -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Test: realtime" \\
  -d '{
    "event": "payment.completed",
    "id": "evt_realtime_001",
    "amount": 2499,
    "currency": "INR"
  }'`;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl bg-card">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-4 animate-pulse">
        <RefreshCw className="size-6 text-muted-foreground animate-spin" style={{ animationDuration: '3s' }} />
      </div>

      <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1">
        Waiting for incoming requests...
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Send an HTTP request to your endpoint URL and it will appear here in real time.
      </p>

      <div className="w-full max-w-xl text-left rounded-lg border bg-muted/40 p-4 font-mono text-xs">
        <div className="flex items-center justify-between mb-2 pb-2 border-b">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Terminal className="size-4" />
            <span className="font-semibold text-foreground">Quick Test with curl</span>
          </div>
          <CopyButton text={curlExample} label="Copy curl" />
        </div>

        <pre className="overflow-x-auto text-foreground leading-5 whitespace-pre-wrap break-all">
          <code>{curlExample}</code>
        </pre>
      </div>
    </div>
  );
}
