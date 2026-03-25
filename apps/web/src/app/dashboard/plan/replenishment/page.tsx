"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, ShoppingCart, Package, CheckCircle } from "lucide-react";

export default function ReplenishmentPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["planning-replenishment"],
    queryFn: () => api.get("/planning/replenishment").then(r => r.data),
  });

  const createPO = useMutation({
    mutationFn: async (items: any[]) => {
      // Group by supplier
      const bySupplier: Record<string, any[]> = {};
      items.forEach(item => {
        const supplierId = item.preferredSupplier?.supplierId || 'no-supplier';
        if (!bySupplier[supplierId]) bySupplier[supplierId] = [];
        bySupplier[supplierId].push(item);
      });

      // Create POs for each supplier
      const results = [];
      for (const [supplierId, supplierItems] of Object.entries(bySupplier)) {
        const poData = {
          supplierId: supplierId === 'no-supplier' ? null : supplierId,
          notes: `Auto-generated from replenishment suggestions`,
          rows: supplierItems.map(item => ({
            variantId: item.variantId,
            description: item.productName,
            qtyOrdered: item.suggestedQty,
          }))
        };
        const result = await api.post("/purchase-orders", poData);
        results.push(result.data);
      }
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["planning-replenishment"] });
      addToast(`Created ${results.length} purchase order(s)`, "success");
      setSelectedItems([]);
    },
  });

  // Calculate summary stats
  const summary = data ? {
    total: data.length,
    critical: data.filter((item: any) => item.currentStock <= 0).length,
    low: data.filter((item: any) => item.currentStock > 0).length,
    totalValue: data.reduce((sum: number, item: any) => sum + (item.suggestedQty * (item.variant?.purchasePrice || 0)), 0)
  } : null;

  const columns: Column[] = [
    { 
      key: "select", 
      header: (
        <input 
          type="checkbox"
          checked={selectedItems.length === data?.length}
          onChange={(e) => setSelectedItems(e.target.checked ? (data?.map((item: any) => item.variantId) || []) : [])}
        />
      ), 
      render: (r: any) => (
        <input 
          type="checkbox"
          checked={selectedItems.includes(r.variantId)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedItems(prev => [...prev, r.variantId]);
            } else {
              setSelectedItems(prev => prev.filter(id => id !== r.variantId));
            }
          }}
        />
      )
    },
    { key: "variantSku", header: "SKU", sortable: true, render: (r: any) => <span className="font-mono text-sm">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", sortable: true, render: (r: any) => <span className="font-medium">{r.productName}</span> },
    { key: "locationName", header: "Location" },
    { key: "currentStock", header: "Current stock", sortable: true },
    { key: "reorderPoint", header: "Reorder point" },
    { key: "suggestedQty", header: "Suggested qty", sortable: true, render: (r: any) => (
      <span className="font-bold text-brand-600">{r.suggestedQty}</span>
    )},
    { key: "preferredSupplier", header: "Preferred supplier", render: (r: any) => r.preferredSupplier?.supplierName || "—" },
    { key: "urgency", header: "Urgency", isStatus: true, filterable: false, render: (r: any) => {
      if (r.currentStock <= 0) return <StatusCell status="not_available" label="Critical" />;
      return <StatusCell status="expected" label="Low" />;
    }},
  ];

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#C62828]"><AlertCircle size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Critical Items</p><p className="text-xl font-bold text-red-600">{summary.critical}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#EF6C00]"><Package size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Low Stock</p><p className="text-xl font-bold text-amber-600">{summary.low}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#1565C0]"><ShoppingCart size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Items to Reorder</p><p className="text-xl font-bold">{summary.total}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#2E7D32]"><CheckCircle size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Est. PO Value</p><p className="text-xl font-bold">${summary.totalValue.toFixed(0)}</p></div>
          </div>
        </div>
      )}

      {/* Suggested Quantities Chart */}
      {data && data.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Suggested Reorder Quantities</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.slice(0, 10)} margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="variantSku" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, "Suggested Qty"]}
                labelFormatter={(label) => `SKU: ${label}`}
              />
              <Bar dataKey="suggestedQty" fill="#1565C0" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Action Bar */}
      {selectedItems.length > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-brand-800">
            {selectedItems.length} item(s) selected
          </span>
          <button 
            className="btn btn-primary"
            onClick={() => {
              const selectedData = data?.filter((item: any) => selectedItems.includes(item.variantId)) || [];
              createPO.mutate(selectedData);
            }}
            disabled={createPO.isPending}
          >
            {createPO.isPending ? "Creating POs..." : "Create Purchase Orders"}
          </button>
        </div>
      )}

      {/* Data Table */}
      <DataTable 
        columns={columns} 
        data={data || []} 
        isLoading={isLoading} 
        emptyMessage="All items are adequately stocked" 
        showRank 
        totalLabel="items need restocking" 
      />
    </div>
  );
}
