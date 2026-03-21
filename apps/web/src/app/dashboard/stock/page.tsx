"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { AlertTriangle } from "lucide-react";

export default function InventoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["inventory-levels"], queryFn: () => api.get("/inventory/levels").then(r => r.data.data) });

  const columns: Column[] = [
    { key: "sku", header: "SKU", sortable: true, render: (r: any) => <span className="font-mono text-sm">{r.variant?.sku || "—"}</span> },
    { key: "item", header: "Item", render: (r: any) => <span className="font-medium">{r.variant?.product?.name || r.variant?.material?.name || "—"}</span> },
    { key: "location", header: "Location", render: (r: any) => r.location?.name || "—" },
    { key: "onHand", header: "On hand", sortable: true, render: (r: any) => <span className="font-semibold">{r.onHand}</span> },
    { key: "reserved", header: "Reserved", render: (r: any) => <span className="text-gray-500">{r.reserved}</span> },
    { key: "available", header: "Available", sortable: true, render: (r: any) => {
      const avail = (r.onHand || 0) - (r.reserved || 0);
      return <span className={avail < 0 ? "text-red-600 font-semibold" : "font-semibold"}>{avail}</span>;
    }},
    { key: "stockStatus", header: "Stock status", isStatus: true, filterable: false, render: (r: any) => {
      const avail = (r.onHand || 0) - (r.reserved || 0);
      const low = r.variant?.reorderPoint && avail <= r.variant.reorderPoint;
      if (avail <= 0) return <StatusCell status="not_available" label="Out of stock" />;
      if (low) return <StatusCell status="expected" label="Low stock" />;
      return <StatusCell status="in_stock" />;
    }},
    { key: "reorderPoint", header: "Reorder at", render: (r: any) => {
      const avail = (r.onHand || 0) - (r.reserved || 0);
      const low = r.variant?.reorderPoint && avail <= r.variant.reorderPoint;
      return (
        <span className="flex items-center gap-1">
          {r.variant?.reorderPoint || "—"}
          {low && <AlertTriangle size={13} className="text-amber-500" />}
        </span>
      );
    }},
  ];

  return (
    <div className="px-4 py-3">
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No inventory levels found" showRank totalLabel="inventory items" />
    </div>
  );
}
