"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Factory, ExternalLink } from "lucide-react";

export default function OperationsSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["product-operations"],
    queryFn: () =>
      api
        .get("/product-operations", { params: { page: 1, pageSize: 50 } })
        .then((r) => r.data.data || r.data || [])
        .catch(() => []),
    retry: false,
  });

  const columns: Column[] = [
    { key: "name", header: "Operation", render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "durationMinutes", header: "Duration (min)", render: (r: any) => r.durationMinutes ?? "—" },
    { key: "costPerHour", header: "Cost/hr", render: (r: any) => (r.costPerHour != null ? `$${Number(r.costPerHour).toFixed(2)}` : "—") },
    { key: "rank", header: "Rank" },
  ];

  return (
    <div className="px-8 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Operations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Production operations are defined per product BOM. Manage factory-wide defaults in Factory settings.
          </p>
        </div>
        <Link href="/dashboard/settings/factory" className="btn btn-ghost text-sm inline-flex items-center gap-1">
          <Factory size={14} />
          Factory settings
          <ExternalLink size={12} />
        </Link>
      </header>

      <div className="px-0">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          emptyMessage="No standalone operations — add operations on product recipes"
          totalLabel="operations"
        />
      </div>
    </div>
  );
}
