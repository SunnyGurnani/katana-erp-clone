"use client";
import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface Props {
  actions: Action[];
}

export function ActionMenu({ actions }: Props) {
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
      <button className="icon-btn" onClick={e => { e.stopPropagation(); setOpen(!open); }}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[140px] py-1">
          {actions.map((a, i) => (
            <button
              key={i}
              className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${a.variant === "danger" ? "text-red-600" : "text-gray-700"} ${a.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              disabled={a.disabled}
              onClick={e => { e.stopPropagation(); a.onClick(); setOpen(false); }}
            >
              <span className="flex items-center gap-2">{a.icon}{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
