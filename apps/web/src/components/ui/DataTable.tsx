"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  filterable?: boolean;
  isStatus?: boolean;
}

interface Props<T = any> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  rowKey?: (row: T) => string;
  showRank?: boolean;
  showFilters?: boolean;
  totalLabel?: string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 100;

function SkeletonTableRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-2.5">
              <div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (j * 17) % 30}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, delay]);
  return debounced;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, isLoading, onRowClick, emptyMessage = "No data found",
  rowKey, showRank = false, showFilters = true, totalLabel, pageSize = DEFAULT_PAGE_SIZE,
}: Props<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const debouncedFilters = useDebounce(filterInputs, 250);

  // Reset to page 1 when filters/sort changes
  useEffect(() => { setPage(1); }, [debouncedFilters, sortCol, sortDir]);

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let result = data;
    for (const [key, val] of Object.entries(debouncedFilters)) {
      if (!val) continue;
      const lower = val.toLowerCase();
      result = result.filter(row => {
        const cell = row[key];
        return cell != null && String(cell).toLowerCase().includes(lower);
      });
    }
    return result;
  }, [data, debouncedFilters]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sorted.length);
  const paginated = sorted.slice(pageStart, pageEnd);

  const allCols = showRank
    ? [{ key: "__rank", header: "#", className: "w-10 text-center" } as Column<T>, ...columns]
    : columns;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {totalLabel && (
        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 flex items-center justify-between gap-2">
          <span>{sorted.length} {totalLabel}{sorted.length !== data.length ? ` (filtered from ${data.length})` : ""}</span>
          {totalPages > 1 && (
            <span className="text-gray-400">Page {safePage} of {totalPages}</span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {allCols.map(col => (
                <th
                  key={col.key}
                  className={`${col.className || ""} ${col.sortable ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortCol === col.key
                        ? (sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
                        : <ArrowUpDown size={10} className="opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
            {showFilters && (
              <tr className="border-b border-gray-200">
                {allCols.map(col => (
                  <th key={`f-${col.key}`} className="px-3 py-1.5 font-normal">
                    {col.filterable !== false &&
                    col.key !== "__rank" &&
                    col.key !== "actions" &&
                    col.key !== "edit" &&
                    (!col.isStatus || col.filterable === true) ? (
                      <input
                        type="text"
                        placeholder="Filter"
                        className="w-full text-[11px] px-2 py-1 border border-gray-200 rounded font-normal text-gray-600 placeholder:text-gray-300 focus:outline-none focus:border-brand-500"
                        value={filterInputs[col.key] || ""}
                        onChange={e => setFilterInputs(f => ({ ...f, [col.key]: e.target.value }))}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonTableRows cols={allCols.length} />
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={allCols.length} className="text-center text-gray-400 py-12">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row) : row.id || (pageStart + i)}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={() => onRowClick?.(row)}
                >
                  {allCols.map(col => {
                    if (col.key === "__rank") {
                      return <td key={col.key} className="text-center text-gray-400 text-xs w-10">{pageStart + i + 1}</td>;
                    }
                    return (
                      <td key={col.key} className={col.isStatus ? "!p-0" : (col.className || "")}>
                        {col.render ? col.render(row, pageStart + i) : row[col.key] ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500">
            {pageStart + 1}–{pageEnd} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="icon-btn p-1 disabled:opacity-30"
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pg: number;
              if (totalPages <= 7) {
                pg = i + 1;
              } else if (safePage <= 4) {
                pg = i < 6 ? i + 1 : totalPages;
              } else if (safePage >= totalPages - 3) {
                pg = i === 0 ? 1 : totalPages - 6 + i;
              } else {
                const offsets = [1, safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2, totalPages];
                pg = offsets[i];
              }
              return (
                <button
                  key={pg}
                  type="button"
                  className={`min-w-[28px] h-7 rounded text-xs font-medium px-1.5 ${pg === safePage ? "bg-brand-600 text-white" : "hover:bg-gray-100 text-gray-600"}`}
                  onClick={() => setPage(pg)}
                >
                  {pg}
                </button>
              );
            })}
            <button
              type="button"
              className="icon-btn p-1 disabled:opacity-30"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
