"use client";
import { Plus, MapPin } from "lucide-react";
import clsx from "clsx";

interface Props {
  statusFilter?: string;
  onStatusFilter?: (status: string) => void;
  statuses?: { label: string; value: string }[];
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

const defaultStatuses = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Done", value: "done" },
];

export function ListToolbar({ statusFilter = "", onStatusFilter, statuses = defaultStatuses, actionLabel, onAction, children }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {onStatusFilter && statuses.map(s => (
          <button
            key={s.value}
            onClick={() => onStatusFilter(s.value)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
              statusFilter === s.value
                ? "bg-navy-800 text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            {s.label}
          </button>
        ))}
        {children}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-[13px] text-gray-600 hover:bg-gray-50">
          <MapPin size={13} />
          All locations
        </button>
        {actionLabel && onAction && (
          <button className="btn-primary text-[13px] py-1.5 px-3 rounded-md inline-flex items-center gap-1.5 font-medium" onClick={onAction}>
            <Plus size={14} strokeWidth={2.5} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
