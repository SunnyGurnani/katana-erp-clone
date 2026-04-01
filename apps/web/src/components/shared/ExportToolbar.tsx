"use client";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Download, ChevronDown } from "lucide-react";
import { useExport } from "./useExport";

interface Props {
  resource: string;
  filters?: Record<string, any>;
  selectedIds?: string[];
}

const MENU_H = 80;
const GAP = 4;

export function ExportToolbar({ resource, filters, selectedIds }: Props) {
  const { exportData, exporting } = useExport();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let top = rect.bottom + GAP;
      if (top + MENU_H > window.innerHeight - 8) {
        top = Math.max(8, rect.top - MENU_H - GAP);
      }
      setMenuStyle({
        position: "fixed",
        top,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
        minWidth: 120,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const menu =
    open &&
    menuStyle &&
    typeof document !== "undefined" &&
    createPortal(
      <div ref={menuRef} className="rounded-md border border-gray-200 bg-white shadow-lg" style={menuStyle}>
        <button
          className="block w-full px-4 py-2 text-left text-xs hover:bg-gray-50"
          onClick={() => {
            exportData(resource, "csv", filters, selectedIds);
            setOpen(false);
          }}
        >
          CSV
        </button>
        <button
          className="block w-full px-4 py-2 text-left text-xs hover:bg-gray-50"
          onClick={() => {
            exportData(resource, "xlsx", filters, selectedIds);
            setOpen(false);
          }}
        >
          Excel (XLSX)
        </button>
      </div>,
      document.body
    );

  return (
    <>
      <div className="relative" ref={triggerRef}>
        <button
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          onClick={() => setOpen(!open)}
          disabled={exporting}
        >
          <Download size={12} />
          <span>{exporting ? "Exporting..." : "Export"}</span>
          <ChevronDown size={12} />
        </button>
      </div>
      {menu}
    </>
  );
}
