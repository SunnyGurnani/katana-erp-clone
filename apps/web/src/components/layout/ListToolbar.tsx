"use client";
import clsx from "clsx";
import { Plus, MapPin, ChevronDown } from "lucide-react";

interface Props {
  statusFilter?: string;
  onStatusChange?: (status: string) => void;
  statuses?: { label: string; value: string }[];
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export function ListToolbar({ statusFilter, onStatusChange, statuses, actionLabel, onAction, children }: Props) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {statuses && onStatusChange && statuses.map(s => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
              statusFilter === s.value
                ? "bg-navy-800 text-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            {s.label}
          </button>
        ))}
        {children}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50">
          <MapPin size={12} />
          <span>All locations</span>
          <ChevronDown size={12} />
        </button>
        {actionLabel && onAction && (
          <button className="btn-primary text-[13px] px-3 py-1.5" onClick={onAction}>
            <Plus size={14} /> {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
