"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { CopyButton } from "@/components/copy-button";
import { RequestList } from "@/components/request-list";
import { EmptyState } from "@/components/empty-state";
import { RequestResponseViewer, HttpMessage } from "@/components/ui/request-response-viewer";
import { WebhookEndpoint, WebhookRequest } from "@/db/schema";
import { ArrowLeft, Trash2, Calendar, RefreshCw, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EndpointDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: endpointId } = use(params);
  const router = useRouter();

  const [endpoint, setEndpoint] = useState<WebhookEndpoint | null>(null);
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const queryParams = new URLSearchParams();
        if (searchQuery) queryParams.set("q", searchQuery);
        if (methodFilter && methodFilter !== "ALL") queryParams.set("method", methodFilter);

        const [epRes, reqRes] = await Promise.all([
          fetch(`/api/endpoints/${endpointId}`),
          fetch(`/api/endpoints/${endpointId}/requests?${queryParams.toString()}`),
        ]);

        const epData = await epRes.json();
        const reqData = await reqRes.json();

        if (active) {
          if (epRes.ok && epData.endpoint) setEndpoint(epData.endpoint);
          if (reqRes.ok && reqData.requests) {
            setRequests(reqData.requests);
            if (reqData.requests.length > 0) {
              setSelectedRequestId((prev) => prev || reqData.requests[0].id);
            } else {
              setSelectedRequestId(undefined);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch endpoint details:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [endpointId, searchQuery, methodFilter]);

  async function handleClearAllRequests() {
    if (!confirm("Are you sure you want to clear all requests for this endpoint?")) return;
    try {
      const res = await fetch(`/api/endpoints/${endpointId}/requests`, { method: "DELETE" });
      if (res.ok) {
        setRequests([]);
        setSelectedRequestId(undefined);
        setShowMobileDetail(false);
      }
    } catch (err) {
      console.error("Failed to clear requests:", err);
    }
  }

  async function handleDeleteSingleRequest(requestId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/requests/${requestId}`, { method: "DELETE" });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (selectedRequestId === requestId) {
          const remaining = requests.filter((r) => r.id !== requestId);
          setSelectedRequestId(remaining.length > 0 ? remaining[0].id : undefined);
        }
      }
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  }

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

  const selectedRequest = requests.find((r) => r.id === selectedRequestId);
  const webhookUrl = endpoint ? `${baseUrl}/h/${endpoint.token}` : "";

  // Prepare HTTP Message payload for Varnus RequestResponseViewer component
  const httpMessage: HttpMessage | undefined = selectedRequest
    ? {
        method: selectedRequest.method,
        url: `${webhookUrl}${selectedRequest.path}`,
        headers: (selectedRequest.headers as Record<string, string>) || {},
        query: (selectedRequest.query as Record<string, string>) || {},
        body: selectedRequest.body || selectedRequest.rawBody || undefined,
      }
    : undefined;

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
      <div className="border-b bg-muted/20 px-4 py-3">
        <div className="container mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-7xl">
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
                <h1 className="font-semibold text-foreground text-base truncate">
                  {endpoint?.name || "Endpoint Details"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                  {requests.length} {requests.length === 1 ? "request" : "requests"}
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

          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
            {endpoint && (
              <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Calendar className="size-3.5" />
                Created {formatDate(endpoint.createdAt)}
              </span>
            )}

            <button
              type="button"
              onClick={handleDeleteEndpoint}
              className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-3 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
              title="Delete Endpoint"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Delete Endpoint</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 flex overflow-hidden container mx-auto px-0 max-w-7xl">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        ) : requests.length === 0 && !searchQuery && methodFilter === "ALL" ? (
          <div className="flex-1 p-6 flex items-center justify-center">
            <EmptyState webhookUrl={webhookUrl} />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            {/* Left Column: Request List */}
            <div
              className={`md:col-span-5 lg:col-span-4 h-full overflow-hidden ${
                showMobileDetail ? "hidden md:block" : "block"
              }`}
            >
              <RequestList
                requests={requests}
                selectedRequestId={selectedRequestId}
                onSelectRequest={(id) => {
                  setSelectedRequestId(id);
                  setShowMobileDetail(true);
                }}
                onClearAll={handleClearAllRequests}
                onDeleteRequest={handleDeleteSingleRequest}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                methodFilter={methodFilter}
                onMethodFilterChange={setMethodFilter}
              />
            </div>

            {/* Right Column: Request Details Inspector */}
            <div
              className={`md:col-span-7 lg:col-span-8 h-full overflow-y-auto p-4 space-y-4 ${
                showMobileDetail ? "block" : "hidden md:block"
              }`}
            >
              {/* Mobile Back Button */}
              <div className="md:hidden flex items-center justify-between border-b pb-3">
                <button
                  type="button"
                  onClick={() => setShowMobileDetail(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to Requests List</span>
                </button>
              </div>

              {selectedRequest && httpMessage ? (
                <div className="space-y-4">
                  {/* Action Bar */}
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <Terminal className="size-4" />
                      <span>Received at {new Date(selectedRequest.receivedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Varnus Component Request / Response Viewer */}
                  <RequestResponseViewer request={httpMessage} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-12 text-center text-xs text-muted-foreground">
                  Select a request from the list to inspect headers, query parameters, and body content.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
