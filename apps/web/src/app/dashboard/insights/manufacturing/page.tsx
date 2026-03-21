"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { SkeletonRows } from "@/components/ui/Skeleton";

const tabs = [
  { label: "Sales", href: "/dashboard/insights" },
  { label: "Manufacturing", href: "/dashboard/insights/manufacturing" },
  { label: "Purchasing", href: "/dashboard/insights/purchasing" },
];

export default function MfgInsightsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-mfg", from, to],
    queryFn: () => api.get("/insights/manufacturing/summary", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  const { data: byProduct, isLoading: productLoading } = useQuery({
    queryKey: ["insights-mfg-product", from, to],
    queryFn: () => api.get("/insights/manufacturing/by-product", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-900 flex-1">Manufacturing Insights</h2>
          <div className="flex items-center gap-2">
            <input className="input w-36 text-[13px]" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="text-gray-400 text-[13px]">to</span>
            <input className="input w-36 text-[13px]" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        {isLoading ? <div className="card"><table className="table"><tbody><SkeletonRows rows={4} /></tbody></table></div> : data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Total MOs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalMOs}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Completed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{data.completedMOs}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Avg Production Time</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{Number(data.avgProductionTime).toFixed(0)}m</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${Number(data.costOverview?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Cost Breakdown</h3></div>
                <div className="p-4 space-y-2.5 text-[13px]">
                  <div className="flex justify-between"><span className="text-gray-600">Material Cost</span><span className="font-semibold">${Number(data.costOverview?.materialCost || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Labor Cost</span><span className="font-semibold">${Number(data.costOverview?.laborCost || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-2.5"><span className="font-semibold text-gray-900">Total</span><span className="font-bold">${Number(data.costOverview?.totalCost || 0).toFixed(2)}</span></div>
                </div>
              </div>

              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Production by Month</h3></div>
                <table className="table">
                  <thead><tr><th>Month</th><th>MO count</th></tr></thead>
                  <tbody>
                    {(data.productionByMonth || []).map((m: any, i: number) => (
                      <tr key={i}><td>{m.month}</td><td className="font-medium">{m.count}</td></tr>
                    ))}
                    {!data.productionByMonth?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-4">No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="card">
          <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Manufacturing by Product</h3></div>
          {productLoading ? <table className="table"><tbody><SkeletonRows rows={5} /></tbody></table> : (
            <table className="table">
              <thead><tr><th>Product</th><th>MO count</th><th>Qty planned</th><th>Qty produced</th></tr></thead>
              <tbody>
                {(byProduct || []).map((p: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{p.productName || "—"}</td>
                    <td>{p.moCount}</td>
                    <td>{p.qtyPlanned}</td>
                    <td>{p.qtyProduced}</td>
                  </tr>
                ))}
                {!(byProduct || []).length && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No data</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
