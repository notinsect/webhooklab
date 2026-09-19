"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { CopyButton } from "@/components/copy-button";
import { RequestList } from "@/components/request-list";
import { EmptyState } from "@/components/empty-state";
import { RequestResponseViewer, HttpMessage } from "@/components/ui/request-response-viewer";
import { useSSE } from "@/hooks/use-sse";
import { redactHeaders } from "@/lib/redaction";
import { WebhookEndpoint, WebhookRequest } from "@/db/schema";
import { ArrowLeft, Trash2, Calendar, RefreshCw, Clock, HardDrive, FileText } from "lucide-react";

export default function EndpointDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: endpointId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [endpoint, setEndpoint] = useState<WebhookEndpoint | null>(null);
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get("page") || "1", 10)));
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(
    searchParams.get("request") || undefined
  );
  const [loading, setLoading] = useState(true);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Search & Filter states
  const [searchQueryInput, setSearchQueryInput] = useState(searchParams.get("q") || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get("q") || "");
  const [methodFilter, setMethodFilter] = useState(searchParams.get("method") || "ALL");

  // Realtime notification banner counter for Page > 1
  const [newRequestsAvailableCount, setNewRequestsAvailableCount] = useState(0);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  // 300ms Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQueryInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQueryInput]);

  // Sync state to URL search params
  const updateUrlParams = useCallback(
    (opts: { reqId?: string; q?: string; method?: string; pageNum?: number }) => {
      const p = new URLSearchParams();
      const currentReqId = opts.reqId !== undefined ? opts.reqId : selectedRequestId;
      const currentQ = opts.q !== undefined ? opts.q : debouncedSearchQuery;
      const currentMethod = opts.method !== undefined ? opts.method : methodFilter;
      const currentPage = opts.pageNum !== undefined ? opts.pageNum : page;

      if (currentReqId) p.set("request", currentReqId);
      if (currentQ) p.set("q", currentQ);
      if (currentMethod && currentMethod !== "ALL") p.set("method", currentMethod);
      if (currentPage > 1) p.set("page", String(currentPage));

      const queryStr = p.toString();
      const newUrl = queryStr ? `?${queryStr}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    },
    [selectedRequestId, debouncedSearchQuery, methodFilter, page]
  );

  const fetchRequests = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearchQuery) queryParams.set("q", debouncedSearchQuery);
      if (methodFilter && methodFilter !== "ALL") queryParams.set("method", methodFilter);
      queryParams.set("page", String(page));
      queryParams.set("limit", "25");

      const reqRes = await fetch(`/api/endpoints/${endpointId}/requests?${queryParams.toString()}`);
      const reqData = await reqRes.json();
      if (reqRes.ok && reqData.requests) {
        setRequests(reqData.requests);
        setTotalCount(reqData.totalCount);
        setTotalPages(reqData.totalPages || 1);

        setSelectedRequestId((prev) => {
          const urlReqId = searchParams.get("request");
          if (urlReqId && reqData.requests.some((r: WebhookRequest) => r.id === urlReqId)) {
            return urlReqId;
          }
          return prev || (reqData.requests.length > 0 ? reqData.requests[0].id : undefined);
        });
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    }
  }, [endpointId, debouncedSearchQuery, methodFilter, page, searchParams]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearchQuery) queryParams.set("q", debouncedSearchQuery);
        if (methodFilter && methodFilter !== "ALL") queryParams.set("method", methodFilter);
        queryParams.set("page", String(page));
        queryParams.set("limit", "25");

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
            setTotalCount(reqData.totalCount);
            setTotalPages(reqData.totalPages || 1);

            const urlReqId = searchParams.get("request");
            if (urlReqId && reqData.requests.some((r: WebhookRequest) => r.id === urlReqId)) {
              setSelectedRequestId(urlReqId);
            } else if (reqData.requests.length > 0) {
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
  }, [endpointId, debouncedSearchQuery, methodFilter, page, searchParams]);

  // Handle request selection & URL update
  const handleSelectRequest = useCallback(
    (id: string) => {
      setSelectedRequestId(id);
      setShowMobileDetail(true);
      updateUrlParams({ reqId: id });
    },
    [updateUrlParams]
  );

  // Handle live SSE updates (FILTER & PAGINATION SAFE)
  const handleNewRequest = useCallback(
    (newReq: WebhookRequest) => {
      // Check if new request matches active method filter
      if (methodFilter !== "ALL" && newReq.method !== methodFilter) {
        return;
      }

      // Check if new request matches active debounced search query
      if (debouncedSearchQuery) {
        const qLower = debouncedSearchQuery.toLowerCase();
        const matchesMethod = newReq.method.toLowerCase().includes(qLower);
        const matchesPath = newReq.path.toLowerCase().includes(qLower);
        const matchesBody = newReq.rawBody ? newReq.rawBody.toLowerCase().includes(qLower) : false;
        const matchesContentType = newReq.contentType ? newReq.contentType.toLowerCase().includes(qLower) : false;
        if (!matchesMethod && !matchesPath && !matchesBody && !matchesContentType) {
          return;
        }
      }

      // If user is on Page 1, prepend request directly
      if (page === 1) {
        setRequests((prev) => {
          if (prev.some((r) => r.id === newReq.id)) return prev;
          // Retain latest 25 on page 1 view
          return [newReq, ...prev.slice(0, 24)];
        });
        setTotalCount((prev) => Math.min(100, prev + 1));
        setSelectedRequestId((current) => current || newReq.id);
      } else {
        // User browsing older history (Page > 1): show banner notification
        setNewRequestsAvailableCount((prev) => prev + 1);
      }
    },
    [page, methodFilter, debouncedSearchQuery]
  );

  const { status: sseStatus } = useSSE({
    endpointId,
    onNewRequest: handleNewRequest,
    onReconnect: fetchRequests,
  });

  const handleClearFilters = useCallback(() => {
    setSearchQueryInput("");
    setDebouncedSearchQuery("");
    setMethodFilter("ALL");
    setPage(1);
    updateUrlParams({ q: "", method: "ALL", pageNum: 1 });
  }, [updateUrlParams]);

  const handleSyncNewRequests = useCallback(() => {
    setPage(1);
    setNewRequestsAvailableCount(0);
    fetchRequests();
    updateUrlParams({ pageNum: 1 });
  }, [fetchRequests, updateUrlParams]);

  async function handleClearAllRequests() {
    if (!confirm("Clear captured requests?\n\nThis will permanently delete all requests captured by this endpoint.")) return;
    try {
      const res = await fetch(`/api/endpoints/${endpointId}/requests`, { method: "DELETE" });
      if (res.ok) {
        setRequests([]);
        setTotalCount(0);
        setTotalPages(1);
        setSelectedRequestId(undefined);
        setShowMobileDetail(false);
        updateUrlParams({ reqId: "", pageNum: 1 });
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
        setTotalCount((prev) => Math.max(0, prev - 1));
        if (selectedRequestId === requestId) {
          const remaining = requests.filter((r) => r.id !== requestId);
          const nextId = remaining.length > 0 ? remaining[0].id : undefined;
          setSelectedRequestId(nextId);
          updateUrlParams({ reqId: nextId || "" });
        }
      }
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  }

  async function handleDeleteEndpoint() {
    if (!confirm("Are you sure you want to delete this endpoint and all its settings?")) return;
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

  // Safe serialized JSON copy of request with REDACTED headers
  const safeCopyRequestJson = selectedRequest
    ? JSON.stringify(
        {
          method: selectedRequest.method,
          path: selectedRequest.path,
          query: selectedRequest.query || {},
          headers: redactHeaders((selectedRequest.headers as Record<string, string>) || {}),
          body: selectedRequest.body || selectedRequest.rawBody || null,
        },
        null,
        2
      )
    : "";

  function formatExactDate(dateStr?: string | Date) {
    if (!dateStr) return "";
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function formatBodySize(bytes?: number | null) {
    if (bytes === undefined || bytes === null) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
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
                
                {/* Realtime Connection Status Indicator */}
                {sseStatus === "live" ? (
                  <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>Reconnecting...</span>
                  </span>
                )}
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
                Retains latest 100 requests
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
        ) : requests.length === 0 && !debouncedSearchQuery && methodFilter === "ALL" ? (
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
                totalCount={totalCount}
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setPage(p);
                  updateUrlParams({ pageNum: p });
                }}
                selectedRequestId={selectedRequestId}
                onSelectRequest={handleSelectRequest}
                onClearAll={handleClearAllRequests}
                onDeleteRequest={handleDeleteSingleRequest}
                searchQuery={searchQueryInput}
                onSearchChange={setSearchQueryInput}
                methodFilter={methodFilter}
                onMethodFilterChange={(m) => {
                  setMethodFilter(m);
                  setPage(1);
                  updateUrlParams({ method: m, pageNum: 1 });
                }}
                onClearFilters={handleClearFilters}
                newRequestsAvailableCount={newRequestsAvailableCount}
                onSyncNewRequests={handleSyncNewRequests}
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
                  {/* Metadata Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 font-mono text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-foreground/80" />
                        <span className="text-foreground">{formatExactDate(selectedRequest.receivedAt)}</span>
                      </div>

                      {selectedRequest.contentType && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-3.5 text-foreground/80" />
                          <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                            {selectedRequest.contentType.split(";")[0]}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <HardDrive className="size-3.5 text-foreground/80" />
                        <span>{formatBodySize(selectedRequest.bodySize)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CopyButton text={selectedRequest.path} label="Copy Path" />
                      <CopyButton text={safeCopyRequestJson} label="Copy Request JSON" />
                    </div>
                  </div>

                  {/* Varnus Component Request / Response Viewer */}
                  <RequestResponseViewer request={httpMessage} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-12 text-center text-xs text-muted-foreground">
                  {requests.length === 0 ? "No requests match your active search filters." : "Select a request from the list to inspect payload details."}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
