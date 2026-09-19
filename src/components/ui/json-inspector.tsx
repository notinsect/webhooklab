"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
} from "lucide-react";

type JsonInspectorProps = {
  data: unknown;
  searchable?: boolean;
  defaultExpandedDepth?: number;
};

type JsonNodeProps = {
  name?: string;
  value: unknown;
  depth: number;
  path: string;
  ancestors: Set<object>;
  query: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
};

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      console.error("Failed to copy");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) {
    return <>{text}</>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, index)}

      <mark className="rounded-sm bg-yellow-200 px-0.5 text-black dark:bg-yellow-700 dark:text-white">
        {text.slice(index, index + query.length)}
      </mark>

      {text.slice(index + query.length)}
    </>
  );
}

function JsonPrimitive({ value, query }: { value: unknown; query: string }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground">
        <Highlight text="null" query={query} />
      </span>
    );
  }

  if (value === undefined) {
    return (
      <span className="italic text-muted-foreground">
        <Highlight text="undefined" query={query} />
      </span>
    );
  }

  if (typeof value === "string") {
    return (
      <span className="text-emerald-700 dark:text-emerald-400">
        &quot;
        <Highlight text={value} query={query} />
        &quot;
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="text-blue-700 dark:text-blue-400">
        <Highlight text={String(value)} query={query} />
      </span>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span className="text-violet-700 dark:text-violet-400">
        <Highlight text={String(value)} query={query} />
      </span>
    );
  }

  if (typeof value === "bigint") {
    return (
      <span className="text-blue-700 dark:text-blue-400">
        <Highlight text={`${value}n`} query={query} />
      </span>
    );
  }

  if (typeof value === "function") {
    return (
      <span className="italic text-muted-foreground">
        ƒ {value.name || "anonymous"}()
      </span>
    );
  }

  if (value instanceof Date) {
    const dateText = Number.isNaN(value.getTime())
      ? "Invalid Date"
      : value.toISOString();

    return (
      <span className="text-amber-700 dark:text-amber-400">
        Date(&quot;
        <Highlight text={dateText} query={query} />
        &quot;)
      </span>
    );
  }

  if (value instanceof RegExp) {
    return (
      <span className="text-pink-700 dark:text-pink-400">
        <Highlight text={value.toString()} query={query} />
      </span>
    );
  }

  return (
    <span>
      <Highlight text={String(value)} query={query} />
    </span>
  );
}

function isSpecialLeaf(value: unknown) {
  return value instanceof Date || value instanceof RegExp;
}

function getEntries(value: unknown): [string, unknown][] {
  if (value instanceof Map) {
    return Array.from(value.entries()).map(([key, child]) => [
      String(key),
      child,
    ]);
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((child, index) => [
      String(index),
      child,
    ]);
  }

  if (value instanceof Error) {
    return [
      ["name", value.name],
      ["message", value.message],
    ];
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value);
  }

  return [];
}

function valueToSearchString(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.name || "anonymous";
  }

  if (typeof value === "bigint") {
    return `${value}n`;
  }

  return String(value);
}

function valueToCopyString(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (typeof value === "bigint") {
    return `${value}n`;
  }

  if (typeof value === "function") {
    return value.toString();
  }

  if (value instanceof Map) {
    return JSON.stringify(Object.fromEntries(value), null, 2);
  }

  if (value instanceof Set) {
    return JSON.stringify(Array.from(value.values()), null, 2);
  }

  if (value instanceof Error) {
    return JSON.stringify(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      null,
      2,
    );
  }

  return String(value);
}

function nodeMatches(
  name: string | undefined,
  value: unknown,
  query: string,
  ancestors = new Set<object>(),
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();

  if (name?.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  if (typeof value !== "object" || value === null || isSpecialLeaf(value)) {
    return valueToSearchString(value).toLowerCase().includes(normalizedQuery);
  }

  if (ancestors.has(value)) {
    return false;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  return getEntries(value).some(([key, child]) =>
    nodeMatches(key, child, query, nextAncestors),
  );
}

function collectExpandablePaths(
  value: unknown,
  path = "$",
  ancestors = new Set<object>(),
): string[] {
  if (typeof value !== "object" || value === null || isSpecialLeaf(value)) {
    return [];
  }

  if (ancestors.has(value)) {
    return [];
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  const paths = [path];

  getEntries(value).forEach(([key, child]) => {
    if (typeof child !== "object" || child === null || isSpecialLeaf(child)) {
      return;
    }

    const childPath = Array.isArray(value)
      ? `${path}[${key}]`
      : `${path}.${key}`;

    paths.push(...collectExpandablePaths(child, childPath, nextAncestors));
  });

  return paths;
}

function collectDefaultExpandedPaths(
  value: unknown,
  maxDepth: number,
  path = "$",
  depth = 0,
  ancestors = new Set<object>(),
): string[] {
  if (
    typeof value !== "object" ||
    value === null ||
    isSpecialLeaf(value) ||
    depth >= maxDepth
  ) {
    return [];
  }

  if (ancestors.has(value)) {
    return [];
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  const paths = [path];

  getEntries(value).forEach(([key, child]) => {
    if (typeof child !== "object" || child === null || isSpecialLeaf(child)) {
      return;
    }

    const childPath = Array.isArray(value)
      ? `${path}[${key}]`
      : `${path}.${key}`;

    paths.push(
      ...collectDefaultExpandedPaths(
        child,
        maxDepth,
        childPath,
        depth + 1,
        nextAncestors,
      ),
    );
  });

  return paths;
}

function JsonNode({
  name,
  value,
  depth,
  path,
  ancestors,
  query,
  expandedPaths,
  onToggle,
}: JsonNodeProps) {
  const isArray = Array.isArray(value);
  const isMap = value instanceof Map;
  const isSet = value instanceof Set;
  const isError = value instanceof Error;
  const specialLeaf = isSpecialLeaf(value);

  const isObject =
    typeof value === "object" && value !== null && !isArray && !specialLeaf;

  const isReference =
    typeof value === "object" && value !== null && !specialLeaf;

  const searching = query.length > 0;

  const matches = nodeMatches(name, value, query, ancestors);

  if (searching && !matches) {
    return null;
  }

  if (isReference && ancestors.has(value as object)) {
    return (
      <div className="group flex min-h-7 items-center gap-2">
        {name !== undefined && (
          <span className="text-muted-foreground">
            <Highlight text={name} query={query} />:
          </span>
        )}

        <span className="italic text-muted-foreground">[Circular]</span>

        <div className="ml-auto">
          <CopyButton value={path} label="Copy path" />
        </div>
      </div>
    );
  }

  const isExpandable = isArray || isObject;

  if (!isExpandable) {
    return (
      <div className="group flex min-h-7 items-center gap-2">
        {name !== undefined && (
          <span className="text-muted-foreground">
            <Highlight text={name} query={query} />:
          </span>
        )}

        <JsonPrimitive value={value} query={query} />

        <div className="ml-auto flex items-center gap-1">
          <CopyButton value={valueToCopyString(value)} label="Copy value" />

          <CopyButton value={path} label="Copy path" />
        </div>
      </div>
    );
  }

  const entries = getEntries(value);

  const typeLabel = isArray
    ? `Array(${entries.length})`
    : isMap
      ? `Map(${entries.length})`
      : isSet
        ? `Set(${entries.length})`
        : isError
          ? "Error"
          : `Object {${entries.length}}`;

  const nextAncestors = new Set(ancestors);

  if (isReference) {
    nextAncestors.add(value as object);
  }

  const isOpen = searching || expandedPaths.has(path);

  return (
    <div>
      <div className="group flex min-h-7 items-center gap-2">
        <button
          type="button"
          onClick={() => onToggle(path)}
          className="flex min-w-0 items-center gap-1 rounded-sm text-left hover:bg-muted"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}

          {name !== undefined && (
            <span className="font-medium">
              <Highlight text={name} query={query} />
            </span>
          )}

          <span className="text-xs text-muted-foreground">{typeLabel}</span>
        </button>

        <div className="ml-auto">
          <CopyButton value={path} label="Copy path" />
        </div>
      </div>

      {isOpen && (
        <div className="ml-4 border-l pl-3">
          {entries.length === 0 ? (
            <div className="min-h-7 text-muted-foreground">
              {isArray
                ? "Empty array"
                : isMap
                  ? "Empty map"
                  : isSet
                    ? "Empty set"
                    : "Empty object"}
            </div>
          ) : (
            entries.map(([key, child]) => {
              const childPath = isArray ? `${path}[${key}]` : `${path}.${key}`;

              return (
                <JsonNode
                  key={key}
                  name={key}
                  value={child}
                  depth={depth + 1}
                  path={childPath}
                  ancestors={nextAncestors}
                  query={query}
                  expandedPaths={expandedPaths}
                  onToggle={onToggle}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function JsonInspector({
  data,
  searchable = true,
  defaultExpandedDepth = 2,
}: JsonInspectorProps) {
  const [query, setQuery] = useState("");

  const defaultPaths = useMemo(
    () => collectDefaultExpandedPaths(data, defaultExpandedDepth),
    [data, defaultExpandedDepth],
  );

  const allPaths = useMemo(() => collectExpandablePaths(data), [data]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(defaultPaths),
  );

  const normalizedQuery = query.trim();

  function togglePath(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedPaths(new Set(allPaths));
  }

  function collapseAll() {
    setExpandedPaths(new Set());
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background font-mono text-sm">
      <div className="flex items-center gap-2 border-b p-2">
        {searchable && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys or values..."
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}

        <button
          type="button"
          onClick={expandAll}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Expand all"
          title="Expand all"
        >
          <ChevronsUpDown className="size-4" />
        </button>

        <button
          type="button"
          onClick={collapseAll}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Collapse all"
          title="Collapse all"
        >
          <ChevronsDownUp className="size-4" />
        </button>
      </div>

      <div className="p-4">
        <JsonNode
          value={data}
          depth={0}
          path="$"
          ancestors={new Set()}
          query={normalizedQuery}
          expandedPaths={expandedPaths}
          onToggle={togglePath}
        />
      </div>
    </div>
  );
}
