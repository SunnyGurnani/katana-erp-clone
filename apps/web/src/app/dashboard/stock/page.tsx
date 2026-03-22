"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { AlertTriangle } from "lucide-react";

export default function InventoryPage() {
  const [tab, setTab] = useState<"levels" | "movements">("levels");

  const { data, isLoading } = useQuery({ queryKey: ["inventory-levels"], queryFn: () => api.get("/inventory/levels").then(r => r.data.data) });
  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => api.get("/inventory-movements").then(r => r.data.data || r.data),
    enabled: tab === "movements",
  });

  const levelCols: Column[] = [
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

  const movCols: Column[] = [
    { key: "createdAt", header: "Date", sortable: true, render: (r: any) => new Date(r.createdAt).toISOString().slice(0, 10) },
    { key: "variant", header: "Item", render: (r: any) => r.variant?.product?.name || r.variant?.material?.name || r.variant?.sku || "—" },
    { key: "movementType", header: "Type", render: (r: any) => <span className="badge">{r.movementType || r.type || "—"}</span> },
    { key: "qty", header: "Qty", render: (r: any) => <span className={Number(r.qty) < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{r.qty > 0 ? "+" : ""}{r.qty}</span> },
    { key: "location", header: "Location", render: (r: any) => r.location?.name || "—" },
    { key: "reference", header: "Reference", render: (r: any) => r.reference || "—" },
  ];

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === "levels" ? "bg-navy-800 text-white" : "text-gray-500 hover:bg-gray-100"}`} onClick={() => setTab("levels")}>Inventory Levels</button>
          <button className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === "movements" ? "bg-navy-800 text-white" : "text-gray-500 hover:bg-gray-100"}`} onClick={() => setTab("movements")}>Movements</button>
        </div>
        <ExportToolbar resource="inventory" />
      </div>

      {tab === "levels" ? (
        <DataTable columns={levelCols} data={data || []} isLoading={isLoading} emptyMessage="No inventory levels found" showRank totalLabel="inventory items" />
      ) : (
        <DataTable columns={movCols} data={movements || []} isLoading={movLoading} emptyMessage="No movements found" showRank totalLabel="movements" />
      )}
    </div>
  );
}
