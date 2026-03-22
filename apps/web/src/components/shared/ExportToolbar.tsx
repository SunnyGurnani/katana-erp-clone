"use client";
import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import { useExport } from "./useExport";

interface Props {
  resource: string;
  filters?: Record<string, any>;
  selectedIds?: string[];
}

export function ExportToolbar({ resource, filters, selectedIds }: Props) {
  const { exportData, exporting } = useExport();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
        onClick={() => setOpen(!open)}
        disabled={exporting}
      >
        <Download size={12} />
        <span>{exporting ? "Exporting..." : "Export"}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[120px]">
          <button className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50" onClick={() => { exportData(resource, "csv", filters, selectedIds); setOpen(false); }}>CSV</button>
          <button className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50" onClick={() => { exportData(resource, "xlsx", filters, selectedIds); setOpen(false); }}>Excel (XLSX)</button>
        </div>
      )}
    </div>
  );
}
