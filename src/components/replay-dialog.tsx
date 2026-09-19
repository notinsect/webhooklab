"use client";

import { useState } from "react";
import { Send, AlertCircle, CheckCircle2, Loader2, X, ShieldAlert } from "lucide-react";
import { WebhookRequest } from "@/db/schema";
import { MethodBadge } from "./method-badge";
import { RequestResponseViewer, HttpMessage } from "@/components/ui/request-response-viewer";
import { SENSITIVE_HEADERS } from "@/lib/redaction";

type ReplayData = {
  id: string;
  destinationUrl: string;
  method: string;
  status: number | null;
  statusText: string | null;
  durationMs: number;
  error: string | null;
  request: HttpMessage;
  response: HttpMessage | null;
};

export function ReplayDialog({
  request,
  isOpen,
  onClose,
}: {
  request: WebhookRequest;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [targetUrl, setTargetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReplayData | null>(null);

  if (!isOpen) return null;

  const capturedHeaders = (request.headers as Record<string, string>) || {};
  const previewHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(capturedHeaders)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerKey)) {
      previewHeaders[k] = "[Excluded for Security]";
    } else {
      previewHeaders[k] = v;
    }
  }

  async function handleReplay(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/requests/${request.id}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationUrl: targetUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to execute request replay");
      } else {
        setResult(data.replay);
      }
    } catch (err) {
      setError((err as Error).message || "Network error while triggering replay");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Send className="size-4 text-emerald-500" />
            <h3 className="font-semibold text-foreground">Replay Webhook Payload</h3>
            <MethodBadge method={request.method} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
          <form onSubmit={handleReplay} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Destination Target URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.dev/webhooks/test"
                  className="flex-1 h-9 rounded-md border bg-background px-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  disabled={loading || !targetUrl.trim()}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Send Replay</span>
                </button>
              </div>
            </div>
          </form>

          {/* Outbound Headers Preview */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldAlert className="size-3.5 text-amber-500" />
              <span>Outbound Security & Header Preview</span>
            </div>
            <div className="font-mono text-[11px] space-y-1 pt-1">
              {Object.entries(previewHeaders).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-muted/40 py-0.5">
                  <span className="text-muted-foreground">{k}:</span>
                  <span className={v.includes("Excluded") ? "text-amber-500 font-semibold" : "text-foreground truncate max-w-xs"}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-lg border bg-card p-4 text-xs shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-semibold text-foreground">Replay Execution Complete</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  {result.status && (
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        result.status >= 200 && result.status < 300
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      HTTP {result.status} {result.statusText}
                    </span>
                  )}
                  <span className="text-muted-foreground">{result.durationMs} ms</span>
                </div>
              </div>

              {/* Varnus RequestResponseViewer Dogfooding */}
              <RequestResponseViewer
                request={result.request}
                response={result.response || undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
