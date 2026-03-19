"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { AlertTriangle } from "lucide-react";

export default function InventoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["inventory-levels"], queryFn: () => api.get("/inventory/levels").then(r => r.data.data) });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Levels</h1>
        <p className="text-sm text-gray-500">Live stock across all locations</p>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={8} /> : (
          <table className="table">
            <thead><tr><th>SKU</th><th>Item</th><th>Location</th><th>On Hand</th><th>Reserved</th><th>Available</th><th>Reorder At</th></tr></thead>
            <tbody>
              {(data || []).map((l: any) => {
                const avail = (l.onHand || 0) - (l.reserved || 0);
                const low = l.variant?.reorderPoint && avail <= l.variant.reorderPoint;
                return (
                  <tr key={l.id} className={low ? "bg-amber-50" : ""}>
                    <td className="font-mono text-sm">{l.variant?.sku || "—"}</td>
                    <td className="font-medium">{l.variant?.product?.name || l.variant?.material?.name || "—"}</td>
                    <td>{l.location?.name || "—"}</td>
                    <td className="font-semibold">{l.onHand}</td>
                    <td className="text-gray-500">{l.reserved}</td>
                    <td className={avail < 0 ? "text-red-600 font-semibold" : ""}>{avail}</td>
                    <td>
                      <span className="flex items-center gap-1">
                        {l.variant?.reorderPoint || "—"}
                        {low && <AlertTriangle size={13} className="text-amber-500" />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
