"use client";

import { useState } from "react";
import { Send, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { WebhookRequest } from "@/db/schema";
import { MethodBadge } from "./method-badge";

type ReplayResult = {
  targetUrl: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
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
  const [result, setResult] = useState<ReplayResult | null>(null);

  if (!isOpen) return null;

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
        body: JSON.stringify({ targetUrl: targetUrl.trim() }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Send className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Replay Webhook Request</h3>
            <MethodBadge method={request.method} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleReplay} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Destination Target URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com/webhooks"
                  className="flex-1 h-9 rounded-md border bg-background px-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  disabled={loading || !targetUrl.trim()}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Replay</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                SSRF protection is active. Private IPs (127.0.0.1, RFC1918, 169.254.169.254) are blocked.
              </p>
            </div>
          </form>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-semibold text-foreground">Replay Delivered</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold ${
                      result.status >= 200 && result.status < 300
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    HTTP {result.status} {result.statusText}
                  </span>
                  <span className="text-muted-foreground">{result.duration} ms</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-muted-foreground block mb-1">Response Body:</span>
                <pre className="overflow-x-auto rounded border bg-background p-2 font-mono text-[11px] max-h-48 whitespace-pre-wrap break-all">
                  <code>{result.body || "[Empty Response]"}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
