"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { WebhookEndpoint } from "@/db/schema";
import { ArrowLeft, Trash2, Calendar, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EndpointDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: endpointId } = use(params);
  const router = useRouter();

  const [endpoint, setEndpoint] = useState<WebhookEndpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  useEffect(() => {
    let active = true;

    async function loadEndpoint() {
      try {
        const res = await fetch(`/api/endpoints/${endpointId}`);
        const data = await res.json();
        if (active && res.ok && data.endpoint) {
          setEndpoint(data.endpoint);
        }
      } catch (err) {
        console.error("Failed to fetch endpoint:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEndpoint();

    return () => {
      active = false;
    };
  }, [endpointId]);

  async function handleDeleteEndpoint() {
    if (!confirm("Are you sure you want to delete this endpoint?")) return;
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete endpoint:", err);
    }
  }

  const webhookUrl = endpoint ? `${baseUrl}/h/${endpoint.token}` : "";

  function formatDate(dateStr?: string | Date) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans antialiased">
      <Navbar />

      {/* Top Endpoint Header Bar */}
      <div className="border-b bg-muted/20 px-4 py-4">
        <div className="container mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-5xl">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-foreground text-lg truncate">
                  {endpoint?.name || "Endpoint Details"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400">
                  Phase 1 Endpoint
                </span>
              </div>

              {webhookUrl && (
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground truncate pt-0.5">
                  <span className="text-foreground/90 truncate">{webhookUrl}</span>
                  <CopyButton text={webhookUrl} label="Copy URL" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
            {endpoint && (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Calendar className="size-3.5" />
                Created {formatDate(endpoint.createdAt)}
              </span>
            )}

            <button
              type="button"
              onClick={handleDeleteEndpoint}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
              title="Delete Endpoint"
            >
              <Trash2 className="size-3.5" />
              <span>Delete Endpoint</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl flex items-center justify-center">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        ) : !endpoint ? (
          <div className="text-center text-sm text-muted-foreground">
            Endpoint not found or deleted.
          </div>
        ) : (
          <div className="w-full">
            <EmptyState webhookUrl={webhookUrl} />
          </div>
        )}
      </main>
    </div>
  );
}
