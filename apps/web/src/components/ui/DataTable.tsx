"use client";
import { useState } from "react";
import { SkeletonRows } from "./Skeleton";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  /** If true, this column uses status-cell styling (full cell bg) */
  isStatus?: boolean;
}

interface Props<T = any> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  skeletonRows?: number;
  /** Show row count label, e.g. "24 orders" */
  countLabel?: string;
  /** Show total sum at top */
  totalRow?: React.ReactNode;
  /** Show rank/row number column */
  showRank?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading,
  emptyMessage = "No data",
  onRowClick,
  rowHref,
  skeletonRows = 8,
  countLabel,
  totalRow,
  showRank,
}: Props<T>) {
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>({});

  function handleRowClick(row: T) {
    if (onRowClick) onRowClick(row);
    else if (rowHref) router.push(rowHref(row));
  }

  const clickable = !!(onRowClick || rowHref);

  // Apply filters
  const filtered = data.filter(row => {
    return Object.entries(filters).every(([key, val]) => {
      if (!val) return true;
      const col = columns.find(c => c.key === key);
      // Get display value for filtering
      const raw = (row as any)[key];
      const display = raw != null ? String(raw) : "";
      return display.toLowerCase().includes(val.toLowerCase());
    });
  });

  return (
    <div className="card overflow-hidden">
      {/* Count and total row */}
      {(countLabel || totalRow) && !isLoading && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-[12px] text-gray-500">
          {countLabel && <span>{filtered.length} {countLabel}</span>}
          {totalRow}
        </div>
      )}

      {isLoading ? (
        <table className="table">
          <thead>
            <tr>
              {showRank && <th className="w-12">#</th>}
              {columns.map(col => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonRows rows={skeletonRows} cols={columns.length + (showRank ? 1 : 0)} />
          </tbody>
        </table>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">{emptyMessage}</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              {showRank && <th className="w-12">#</th>}
              {columns.map(col => (
                <th key={col.key} className={col.className}>
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && col.header && (
                      <ChevronDown size={10} className="text-gray-400" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
            {/* Filter row */}
            <tr className="border-b border-gray-200">
              {showRank && <th className="px-3 py-1.5" />}
              {columns.map(col => (
                <th key={`filter-${col.key}`} className="px-2 py-1.5 font-normal">
                  {col.filterable !== false && col.header ? (
                    <input
                      type="text"
                      placeholder="Filter"
                      value={filters[col.key] || ""}
                      onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
                      className="w-full text-[11px] font-normal text-gray-600 placeholder-gray-400 border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-500"
                    />
                  ) : <div />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => handleRowClick(row)}
                className={clickable ? "cursor-pointer" : ""}
              >
                {showRank && (
                  <td className="text-[12px] text-gray-400 text-center w-12">{i + 1}</td>
                )}
                {columns.map(col => (
                  <td key={col.key} className={col.isStatus ? "!p-0" : col.className}>
                    {col.render ? col.render(row, i) : (row as any)[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
