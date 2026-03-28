"use client";
import clsx from "clsx";
import { useState, useRef, useEffect } from "react";
import { Plus, MapPin, ChevronDown } from "lucide-react";

export interface ListToolbarLocation {
  id: string;
  name: string;
}

interface Props {
  statusFilter?: string;
  onStatusChange?: (status: string) => void;
  statuses?: { label: string; value: string }[];
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  /** When set with onLocationChange, the location control becomes a working dropdown */
  locations?: ListToolbarLocation[];
  locationFilter?: string;
  onLocationChange?: (locationId: string) => void;
}

export function ListToolbar({
  statusFilter,
  onStatusChange,
  statuses,
  actionLabel,
  onAction,
  children,
  locations,
  locationFilter = "",
  onLocationChange,
}: Props) {
  const [locOpen, setLocOpen] = useState(false);
  const locWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!locOpen) return;
    function onDocClick(e: MouseEvent) {
      if (locWrapRef.current && !locWrapRef.current.contains(e.target as Node)) setLocOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [locOpen]);

  const locationLabel =
    !locationFilter || !locations?.length
      ? "All locations"
      : locations.find((l) => l.id === locationFilter)?.name ?? "All locations";

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {statuses && onStatusChange && statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onStatusChange(s.value)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
              statusFilter === s.value
                ? "bg-navy-800 text-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
            )}
          >
            {s.label}
          </button>
        ))}
        {children}
      </div>
      <div className="flex items-center gap-2">
        {locations && onLocationChange ? (
          <div className="relative" ref={locWrapRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocOpen((o) => !o);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              aria-expanded={locOpen}
              aria-haspopup="listbox"
            >
              <MapPin size={12} className="text-gray-500" />
              <span>{locationLabel}</span>
              <ChevronDown size={12} className={clsx("transition-transform", locOpen && "rotate-180")} />
            </button>
            {locOpen && (
              <ul
                className="absolute right-0 mt-1 z-30 min-w-[220px] max-h-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg text-[13px]"
                role="listbox"
              >
                <li>
                  <button
                    type="button"
                    role="option"
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-800"
                    onClick={() => {
                      onLocationChange("");
                      setLocOpen(false);
                    }}
                  >
                    All locations
                  </button>
                </li>
                {locations.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      role="option"
                      className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-800"
                      onClick={() => {
                        onLocationChange(l.id);
                        setLocOpen(false);
                      }}
                    >
                      {l.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {actionLabel && onAction && (
          <button type="button" className="btn-primary text-[13px] px-3 py-1.5" onClick={onAction}>
            <Plus size={14} /> {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
