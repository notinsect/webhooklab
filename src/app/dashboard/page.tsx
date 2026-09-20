"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { CopyButton } from "@/components/copy-button";
import { CreateEndpointDialog } from "@/components/create-endpoint-dialog";
import { ExternalLink, Trash2, Plus, Terminal, RefreshCw, Calendar, Activity } from "lucide-react";

type EndpointSummary = {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  requestCount: number;
  lastRequestAt: string | null;
};

export default function DashboardPage() {
  const [endpoints, setEndpoints] = useState<EndpointSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/endpoints");
        const data = await res.json();
        if (active && res.ok && data.endpoints) {
          setEndpoints(data.endpoints);
        }
      } catch (err) {
        console.error("Failed to fetch endpoints:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function handleDeleteEndpoint(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this endpoint and all its captured requests?")) return;

    try {
      const res = await fetch(`/api/endpoints/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete endpoint:", err);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatRelative(dateStr: string | null) {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans antialiased">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Webhook Endpoints
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage your active HTTP endpoints and view captured request logs.
            </p>
          </div>

          {endpoints.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create Endpoint</span>
            </button>
          )}
        </div>

        {/* Content List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        ) : endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-card">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-4">
              <Terminal className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              No Webhook Endpoints
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-6">
              Create your first endpoint to start capturing HTTP requests from Stripe, GitHub, or curl.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create Endpoint</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {endpoints.map((ep) => {
              const fullUrl = `${baseUrl}/h/${ep.token}`;
              return (
                <div
                  key={ep.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border bg-card transition-colors hover:border-foreground/20"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/endpoints/${ep.id}`}
                        className="font-semibold text-base text-foreground hover:underline truncate"
                      >
                        {ep.name}
                      </Link>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
                        {ep.requestCount} {ep.requestCount === 1 ? "request" : "requests"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground max-w-xl truncate">
                      <span className="text-foreground/90 truncate">{fullUrl}</span>
                      <CopyButton text={fullUrl} label="Copy URL" />
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Created {formatDate(ep.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="size-3" />
                        Last active {formatRelative(ep.lastRequestAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Link
                      href={`/dashboard/endpoints/${ep.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <span>Open Inspector</span>
                      <ExternalLink className="size-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteEndpoint(ep.id, e)}
                      className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
                      title="Delete Endpoint"
                      aria-label="Delete Endpoint"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <CreateEndpointDialog
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          fetch("/api/endpoints")
            .then((r) => r.json())
            .then((data) => {
              if (data.endpoints) setEndpoints(data.endpoints);
            });
        }}
      />
    </div>
  );
}
