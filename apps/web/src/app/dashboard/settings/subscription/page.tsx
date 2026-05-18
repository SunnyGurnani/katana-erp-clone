"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CreditCard } from "lucide-react";

export default function SubscriptionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get("/app-settings/subscription").then((r) => r.data),
  });

  return (
    <div className="px-8 py-6 space-y-6 max-w-2xl">
      <header className="flex items-start gap-3">
        <CreditCard className="text-brand-600 mt-0.5" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">Your ForgeERP plan and billing overview.</p>
        </div>
      </header>

      <div className="card p-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Current plan</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data?.plan || "Professional"}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 capitalize">
                {data?.status || "active"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
              <div>
                <dt className="text-gray-500">Seats</dt>
                <dd className="font-semibold text-gray-900">{data?.seats ?? 5}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Renews</dt>
                <dd className="font-semibold text-gray-900">
                  {data?.renewsAt ? new Date(data.renewsAt).toLocaleDateString() : "—"}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              Billing is managed outside this app. Contact your administrator to change plans or seats.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
