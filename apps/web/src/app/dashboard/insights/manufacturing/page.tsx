"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Wrench, CheckCircle, Clock, DollarSign } from "lucide-react";
import { InsightsBarChart } from "@/components/insights/InsightsBarChart";

export default function ManufacturingInsightsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-mfg", from, to],
    queryFn: () => api.get("/insights/manufacturing/summary", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  const { data: byProduct, isLoading: bpLoading } = useQuery({
    queryKey: ["insights-mfg-product", from, to],
    queryFn: () => api.get("/insights/manufacturing/by-product", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <div><label className="label">From</label><input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>

      {isLoading ? <table className="table"><tbody><SkeletonRows rows={3} /></tbody></table> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#7B1FA2]"><Wrench size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Total MOs</p><p className="text-xl font-bold">{data.totalMOs}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#2E7D32]"><CheckCircle size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Completed</p><p className="text-xl font-bold">{data.completedMOs}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#1565C0]"><Clock size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Avg Production (days)</p><p className="text-xl font-bold">{Number(data.avgProductionTime || 0).toFixed(1)}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#EF6C00]"><DollarSign size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Total Cost</p><p className="text-xl font-bold">${Number(data.costOverview?.totalCost || 0).toFixed(2)}</p></div>
            </div>
          </div>

          {data.costOverview && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Cost Breakdown</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500 text-xs">Material Cost</p><p className="font-semibold">${Number(data.costOverview.materialCost).toFixed(2)}</p></div>
                <div><p className="text-gray-500 text-xs">Labor Cost</p><p className="font-semibold">${Number(data.costOverview.laborCost).toFixed(2)}</p></div>
              </div>
            </div>
          )}

          {data.productionByMonth?.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-sm text-gray-800 mb-3">Production by Month</h2>
              <InsightsBarChart
                data={data.productionByMonth.map((m: any) => ({ label: m.month, value: Number(m.count) }))}
                color="#7B1FA2"
              />
            </div>
          )}
        </>
      )}

      {!bpLoading && byProduct?.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200"><h2 className="font-semibold text-sm text-gray-800">Manufacturing by Product</h2></div>
          <table className="table">
            <thead><tr><th>Product</th><th>MO Count</th><th>Qty Planned</th><th>Qty Produced</th></tr></thead>
            <tbody>
              {byProduct.map((p: any) => (
                <tr key={p.productId}>
                  <td className="font-medium">{p.productName || "—"}</td>
                  <td>{p.moCount}</td>
                  <td>{p.totalQtyPlanned}</td>
                  <td className="font-semibold">{p.totalQtyProduced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
