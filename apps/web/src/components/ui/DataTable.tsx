"use client";
import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";

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
}

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

export function DataTable<T extends Record<string, any>>({
  columns, data, isLoading, onRowClick, emptyMessage = "No data found", rowKey, showRank = false, showFilters = true, totalLabel,
}: Props<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<Record<string, string>>({});

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
    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue;
      const lower = val.toLowerCase();
      result = result.filter(row => {
        const cell = row[key];
        return cell != null && String(cell).toLowerCase().includes(lower);
      });
    }
    return result;
  }, [data, filters]);

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

  const allCols = showRank
    ? [{ key: "__rank", header: "#", className: "w-10 text-center" } as Column<T>, ...columns]
    : columns;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {totalLabel && (
        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
          {sorted.length} {totalLabel}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            {/* Header row */}
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
            {/* Filter row */}
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
                        value={filters[col.key] || ""}
                        onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
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
              sorted.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row) : row.id || i}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={() => onRowClick?.(row)}
                >
                  {allCols.map(col => {
                    if (col.key === "__rank") {
                      return <td key={col.key} className="text-center text-gray-400 text-xs w-10">{i + 1}</td>;
                    }
                    return (
                      <td key={col.key} className={col.isStatus ? "!p-0" : (col.className || "")}>
                        {col.render ? col.render(row, i) : row[col.key] ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
