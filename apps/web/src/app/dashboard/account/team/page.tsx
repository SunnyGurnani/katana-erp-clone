"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import Link from "next/link";

export default function TeamPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["users-team"],
    queryFn: () => api.get("/users", { params: { pageSize: 100 } }).then((r) => r.data.data || r.data),
  });

  const columns: Column[] = [
    { key: "fullName", header: "Name", render: (r: any) => <span className="font-medium">{r.fullName || "—"}</span> },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: (r: any) => <span className="badge">{r.role?.name || "—"}</span> },
    {
      key: "isActive",
      header: "Status",
      render: (r: any) => (
        <StatusCell status={r.isActive ? "in_stock" : "not_available"} label={r.isActive ? "Active" : "Inactive"} />
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (r: any) => new Date(r.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="px-8 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Users with access to this ForgeERP account.</p>
        </div>
        <Link href="/dashboard/settings/users" className="btn btn-primary text-sm">
          Manage users
        </Link>
      </header>

      <nav className="flex gap-4 text-sm border-b border-gray-200 pb-2">
        <Link href="/dashboard/account" className="text-gray-500 hover:text-gray-800">
          Profile
        </Link>
        <Link href="/dashboard/account/company" className="text-gray-500 hover:text-gray-800">
          Company
        </Link>
        <span className="font-medium text-brand-700 border-b-2 border-brand-600 -mb-2.5 pb-2">Team</span>
      </nav>

      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No users" totalLabel="users" />
    </div>
  );
}
