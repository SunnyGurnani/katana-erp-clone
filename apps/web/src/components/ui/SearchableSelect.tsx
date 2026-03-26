"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

export type SearchableOption = { value: string; label: string };

const MAX_VISIBLE = 200;

type Props = {
  value?: string;
  onChange: (value: string) => void;
  /** Defaults to [] if omitted — avoids runtime crash when data is still loading. */
  options?: SearchableOption[];
  placeholder?: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyOptionLabel,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: Props) {
  const list = options ?? [];
  const selectedValue = value ?? "";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(() => {
    if (!selectedValue) return "";
    return list.find((o) => o.value === selectedValue)?.label ?? "";
  }, [selectedValue, list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => o.label.toLowerCase().includes(q));
  }, [list, query]);

  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE), [filtered]);
  const truncated = filtered.length > visible.length;

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const pick = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const displayValue = open ? query : selectedLabel;

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          disabled={disabled}
          className="input w-full pr-9"
          placeholder={!selectedValue ? placeholder : undefined}
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(selectedLabel);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(selectedLabel);
            }
          }}
        />
        <ChevronDown
          className={clsx(
            "pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </div>
      {open && !disabled && (
        <div
          className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {emptyOptionLabel && (
            <button
              type="button"
              role="option"
              className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick("")}
            >
              {emptyOptionLabel}
            </button>
          )}
          {visible.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
          )}
          {visible.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === selectedValue}
              className={clsx(
                "w-full px-3 py-2 text-left text-sm hover:bg-blue-50",
                o.value === value && "bg-blue-50/90 font-medium text-navy-900"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
          {truncated && (
            <div className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
              Showing {MAX_VISIBLE} of {filtered.length} — type to narrow
            </div>
          )}
        </div>
      )}
    </div>
  );
}
