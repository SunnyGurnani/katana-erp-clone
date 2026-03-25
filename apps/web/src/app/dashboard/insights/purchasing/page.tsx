"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { DollarSign, Package, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function PurchasingInsightsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-purchasing", from, to],
    queryFn: () => api.get("/insights/purchasing/summary", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <div><label className="label">From</label><input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>

      {isLoading ? <table className="table"><tbody><SkeletonRows rows={3} /></tbody></table> : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#1565C0]"><DollarSign size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Total PO Spend</p><p className="text-xl font-bold">${Number(data.totalPOSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#7B1FA2]"><Package size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">PO Count</p><p className="text-xl font-bold">{data.poCount}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#EF6C00]"><TrendingDown size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Avg PO Value</p><p className="text-xl font-bold">${Number(data.avgPOValue || 0).toFixed(2)}</p></div>
            </div>
          </div>

          {data.topSuppliers?.length > 0 && (
            <div className="border border-gray-200 rounded-lg bg-white p-4">
              <h2 className="font-semibold text-sm text-gray-800 mb-4">Top Suppliers by PO Volume</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.topSuppliers.slice(0, 5).map((s: any, i: number) => ({
                      name: s.supplierName || "Unknown",
                      value: s.poCount,
                      fill: ['#1565C0', '#7B1FA2', '#2E7D32', '#EF6C00', '#C62828'][i % 5]
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.spendByMonth?.length > 0 && (
            <div className="border border-gray-200 rounded-lg bg-white p-4">
              <h2 className="font-semibold text-sm text-gray-800 mb-4">Purchasing Spend Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.spendByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Spend"]} />
                  <Line 
                    type="monotone" 
                    dataKey="spend" 
                    stroke="#EF6C00" 
                    strokeWidth={2}
                    dot={{ fill: "#EF6C00", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
