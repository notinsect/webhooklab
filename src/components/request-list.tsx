"use client";

import { useEffect, useRef } from "react";
import { WebhookRequest } from "@/db/schema";
import { MethodBadge } from "./method-badge";
import { Search, Trash2, Filter, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const HTTP_METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"];

export function RequestList({
  requests,
  totalCount,
  page,
  totalPages,
  onPageChange,
  selectedRequestId,
  onSelectRequest,
  onClearAll,
  onDeleteRequest,
  searchQuery,
  onSearchChange,
  methodFilter,
  onMethodFilterChange,
  onClearFilters,
  newRequestsAvailableCount,
  onSyncNewRequests,
}: {
  requests: WebhookRequest[];
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  selectedRequestId?: string;
  onSelectRequest: (id: string) => void;
  onClearAll: () => void;
  onDeleteRequest: (id: string, e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  methodFilter: string;
  onMethodFilterChange: (method: string) => void;
  onClearFilters: () => void;
  newRequestsAvailableCount?: number;
  onSyncNewRequests?: () => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard UX: '/' focuses search input, 'Escape' clears search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        onSearchChange("");
        searchInputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearchChange]);

  function formatRelativeTime(dateStr: string | Date) {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 5) return "now";
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getPayloadHint(req: WebhookRequest): string {
    if (req.query && Object.keys(req.query).length > 0) {
      const keys = Object.keys(req.query);
      return `?${keys[0]}=${req.query[keys[0]]}`;
    }
    if (req.body && typeof req.body === "object") {
      try {
        const keys = Object.keys(req.body);
        if (keys.length > 0) return `{ ${keys.slice(0, 2).join(", ")}${keys.length > 2 ? "..." : ""} }`;
      } catch {
        // Fallback
      }
    }
    if (req.rawBody) {
      const trimmed = req.rawBody.trim();
      return trimmed.length > 30 ? trimmed.slice(0, 30) + "..." : trimmed;
    }
    return "";
  }

  const hasActiveFilters = Boolean(searchQuery || (methodFilter && methodFilter !== "ALL"));

  return (
    <div className="flex flex-col h-full border-r bg-card/50">
      {/* Search & Filter Bar */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search requests... (/)"
              className="w-full h-8 pl-8 pr-7 text-xs rounded-md border bg-background font-mono outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="size-3.5" />
              </button>
            )}
          </div>

          {totalCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors shrink-0"
              title="Clear request history"
              aria-label="Clear request history"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        {/* Method Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
          <Filter className="size-3 text-muted-foreground shrink-0 ml-1 mr-0.5" />
          {HTTP_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onMethodFilterChange(method)}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors shrink-0",
                methodFilter === method
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* New Requests Available Banner (when browsing older history or filtered state) */}
      {newRequestsAvailableCount && newRequestsAvailableCount > 0 && onSyncNewRequests ? (
        <button
          type="button"
          onClick={onSyncNewRequests}
          className="w-full bg-blue-500/10 border-b border-blue-500/30 px-3 py-1.5 text-center text-xs font-mono font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1.5"
        >
          <span className="size-2 rounded-full bg-blue-500 animate-ping" />
          <span>{newRequestsAvailableCount} new {newRequestsAvailableCount === 1 ? "request" : "requests"} available</span>
        </button>
      ) : null}

      {/* Header Counter Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 text-[11px] font-mono text-muted-foreground">
        <span>REQUESTS ({totalCount})</span>
        <span className="text-[10px]">RETAINS LATEST 100</span>
      </div>

      {/* Request List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {requests.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? "No requests match your filters." : "No requests found."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex h-7 items-center justify-center rounded border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          requests.map((req) => {
            const isSelected = req.id === selectedRequestId;
            const hint = getPayloadHint(req);

            return (
              <div
                key={req.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectRequest(req.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectRequest(req.id);
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-1 p-3 text-left transition-colors cursor-pointer outline-none focus-visible:bg-muted/60",
                  isSelected
                    ? "bg-muted/80 border-l-2 border-l-foreground"
                    : "hover:bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MethodBadge method={req.method} />
                    <span className="font-mono text-xs font-medium text-foreground truncate">
                      {req.path}
                    </span>
                  </div>

                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(req.receivedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground truncate pl-0.5">
                    {hint || (req.contentType ? req.contentType.split(";")[0] : "")}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => onDeleteRequest(req.id, e)}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors md:opacity-0 md:group-hover:opacity-100 shrink-0"
                    title="Delete request"
                    aria-label="Delete request"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t bg-muted/20 text-xs font-mono">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
            <span>Prev</span>
          </button>

          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <span>Next</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
