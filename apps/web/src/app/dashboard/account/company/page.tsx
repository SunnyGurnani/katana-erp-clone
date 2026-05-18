"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SkeletonRows } from "@/components/ui/Skeleton";
import Link from "next/link";

export default function CompanyPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "",
    email: "",
    phone: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["factory"],
    queryFn: () => api.get("/factory").then((r) => r.data).catch(() => ({})),
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name || "",
        address: data.address || "",
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        email: data.email || "",
        phone: data.phone || "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put("/factory", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["factory"] });
      addToast("Company details saved", "success");
    },
    onError: () => addToast("Could not save company", "error"),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Company</h1>
        <p className="text-sm text-gray-500 mt-1">Business name and contact details on documents.</p>
      </header>

      <nav className="flex gap-4 text-sm border-b border-gray-200 pb-2">
        <Link href="/dashboard/account" className="text-gray-500 hover:text-gray-800">
          Profile
        </Link>
        <span className="font-medium text-brand-700 border-b-2 border-brand-600 -mb-2.5 pb-2">Company</span>
        <Link href="/dashboard/account/team" className="text-gray-500 hover:text-gray-800">
          Team
        </Link>
      </nav>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Company name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            className="input min-h-[80px]"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Timezone</label>
          <input
            className="input"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
