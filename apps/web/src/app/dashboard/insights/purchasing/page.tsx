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

export default function PurchasingInsightsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-purchasing", from, to],
    queryFn: () => api.get("/insights/purchasing/summary", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-900 flex-1">Purchasing Insights</h2>
          <div className="flex items-center gap-2">
            <input className="input w-36 text-[13px]" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="text-gray-400 text-[13px]">to</span>
            <input className="input w-36 text-[13px]" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        {isLoading ? <div className="card"><table className="table"><tbody><SkeletonRows rows={4} /></tbody></table></div> : data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Total PO Spend</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${Number(data.totalPOSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">PO Count</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.poCount}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Avg PO Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${Number(data.avgPOValue || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Top Suppliers</h3></div>
                <table className="table">
                  <thead><tr><th>Supplier</th><th>Spend</th></tr></thead>
                  <tbody>
                    {(data.topSuppliers || []).map((s: any, i: number) => (
                      <tr key={i}>
                        <td className="font-medium">{s.supplierName || "Unknown"}</td>
                        <td>${Number(s.spend).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {!data.topSuppliers?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-4">No data</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Spend by Month</h3></div>
                <table className="table">
                  <thead><tr><th>Month</th><th>Spend</th></tr></thead>
                  <tbody>
                    {(data.spendByMonth || []).map((m: any, i: number) => (
                      <tr key={i}>
                        <td>{m.month}</td>
                        <td className="font-medium">${Number(m.spend).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {!data.spendByMonth?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-4">No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
