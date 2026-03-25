"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp, Package } from "lucide-react";

export default function ForecastPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { data, isLoading } = useQuery({
    queryKey: ["planning-forecast"],
    queryFn: () => api.get("/planning/forecast").then(r => r.data),
  });

  // Calculate summary stats
  const summary = data ? {
    total: data.length,
    shortage: data.filter((item: any) => item.projected < 0).length,
    atRisk: data.filter((item: any) => item.projected === 0).length,
    healthy: data.filter((item: any) => item.projected > 0).length,
    totalValue: data.reduce((sum: number, item: any) => sum + (item.onHand * (item.variant?.purchasePrice || 0)), 0)
  } : null;

  // Prepare chart data
  const chartData = data ? [
    { name: 'Shortage', value: summary?.shortage || 0, fill: '#C62828' },
    { name: 'At Risk', value: summary?.atRisk || 0, fill: '#EF6C00' },
    { name: 'Healthy', value: summary?.healthy || 0, fill: '#2E7D32' },
  ] : [];

  // Filter data based on status
  const filteredData = data ? data.filter((item: any) => {
    if (statusFilter === "shortage") return item.projected < 0;
    if (statusFilter === "atRisk") return item.projected === 0;
    if (statusFilter === "healthy") return item.projected > 0;
    return true;
  }) : [];

  const columns: Column[] = [
    { key: "variantSku", header: "SKU", sortable: true, render: (r: any) => <span className="font-mono text-sm">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", sortable: true, render: (r: any) => <span className="font-medium">{r.productName}</span> },
    { key: "locationName", header: "Location" },
    { key: "onHand", header: "On hand", sortable: true, render: (r: any) => <span className="font-semibold">{r.onHand}</span> },
    { key: "expected", header: "Expected", render: (r: any) => <span className="text-green-600 font-medium">+{r.expected}</span> },
    { key: "committed", header: "Committed", render: (r: any) => <span className="text-red-600 font-medium">-{r.committed}</span> },
    { key: "projected", header: "Projected", sortable: true, render: (r: any) => (
      <span className={`font-bold ${r.projected < 0 ? "text-red-600" : r.projected === 0 ? "text-amber-600" : "text-gray-900"}`}>
        {r.projected}
      </span>
    )},
    { key: "stockStatus", header: "Status", isStatus: true, filterable: false, render: (r: any) => {
      if (r.projected < 0) return <StatusCell status="not_available" label="Shortage" />;
      if (r.projected === 0) return <StatusCell status="expected" label="At risk" />;
      return <StatusCell status="in_stock" label="OK" />;
    }},
  ];

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#C62828]"><AlertTriangle size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Shortages</p><p className="text-xl font-bold text-red-600">{summary.shortage}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#EF6C00]"><TrendingDown size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">At Risk</p><p className="text-xl font-bold text-amber-600">{summary.atRisk}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#2E7D32]"><TrendingUp size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Healthy</p><p className="text-xl font-bold text-green-600">{summary.healthy}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="rounded-lg p-2.5 bg-[#1565C0]"><Package size={18} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Total Items</p><p className="text-xl font-bold">{summary.total}</p></div>
          </div>
        </div>
      )}

      {/* Status Distribution Chart */}
      {chartData.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-gray-800 mb-4">Inventory Health Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filter by status:</span>
        {[
          { key: "all", label: "All Items" },
          { key: "shortage", label: "Shortages" },
          { key: "atRisk", label: "At Risk" },
          { key: "healthy", label: "Healthy" },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              statusFilter === filter.key 
                ? "bg-brand-600 text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable 
        columns={columns} 
        data={filteredData || []} 
        isLoading={isLoading} 
        emptyMessage="No inventory data available" 
        showRank 
        totalLabel="items" 
      />
    </div>
  );
}
