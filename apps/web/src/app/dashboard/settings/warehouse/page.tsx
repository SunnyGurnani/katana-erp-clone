"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MapPin, ExternalLink } from "lucide-react";

export default function WarehouseSettingsPage() {
  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations", "warehouse-settings"],
    queryFn: () => api.get("/locations", { params: { pageSize: 100 } }).then((r) => r.data.data || r.data),
  });

  const { data: defaults } = useQuery({
    queryKey: ["account-defaults"],
    queryFn: () => api.get("/app-settings/account-defaults").then((r) => r.data),
  });

  const defaultLoc = (locations || []).find((l: any) => l.id === defaults?.defaultLocationId);

  return (
    <div className="px-8 py-6 space-y-6 max-w-2xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Warehouse settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage warehouses and storage locations used for stock, sales, and manufacturing.
        </p>
      </header>

      <div className="card p-5 space-y-3">
        <p className="text-sm font-medium text-gray-800">Default warehouse</p>
        <p className="text-sm text-gray-600">
          {defaultLoc ? (
            <>
              <MapPin size={14} className="inline mr-1 text-brand-600" />
              {defaultLoc.name}
            </>
          ) : (
            "No default location set."
          )}
        </p>
        <Link href="/dashboard/settings/account-defaults" className="text-sm text-brand-600 hover:text-brand-800 font-medium">
          Change in account defaults →
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-800">Locations</h2>
          <Link
            href="/dashboard/items/locations"
            className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
          >
            Manage all <ExternalLink size={12} />
          </Link>
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(locations || []).map((loc: any) => (
              <li key={loc.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{loc.name}</span>
                <span className="text-xs text-gray-500">
                  {loc.isDefault ? "Default" : loc.isActive === false ? "Inactive" : "Active"}
                </span>
              </li>
            ))}
            {(locations || []).length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">No locations yet</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
