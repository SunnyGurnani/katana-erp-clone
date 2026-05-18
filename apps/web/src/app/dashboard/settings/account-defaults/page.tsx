"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { locationOptions } from "@/lib/catalogOptions";
import { SkeletonRows } from "@/components/ui/Skeleton";

export default function AccountDefaultsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["account-defaults"],
    queryFn: () => api.get("/app-settings/account-defaults").then((r) => r.data),
    retry: false,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations", { params: { pageSize: 250 } }).then((r) => r.data.data || r.data),
  });

  const { data: currencies } = useQuery({
    queryKey: ["currencies"],
    queryFn: () => api.get("/currencies").then((r) => r.data.data || r.data).catch(() => []),
  });

  const locOpts = useMemo(() => locationOptions(locations), [locations]);

  useEffect(() => {
    if (data) {
      setDefaultLocationId(data.defaultLocationId || "");
      setDefaultCurrency(data.defaultCurrency || data.currency || "USD");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch("/app-settings/account-defaults", {
        defaultLocationId: defaultLocationId || null,
        defaultCurrency,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-defaults"] });
      addToast("Account defaults saved", "success");
    },
    onError: () => addToast("Could not save defaults", "error"),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Account defaults</h1>
        <p className="text-sm text-gray-500 mt-1">Default location and currency for new documents.</p>
      </header>

      {isError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Using factory settings as fallback where app-settings is unavailable.
        </p>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Default location</label>
          <SearchableSelect
            value={defaultLocationId}
            onChange={setDefaultLocationId}
            options={locOpts}
            placeholder="Search locations…"
            emptyOptionLabel="— None —"
          />
        </div>
        <div>
          <label className="label">Default currency</label>
          <select className="input" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
            {(currencies?.length ? currencies : [{ code: "USD" }]).map((c: any) => (
              <option key={c.code || c.id} value={c.code || c.id}>
                {c.code} {c.name ? `— ${c.name}` : ""}
              </option>
            ))}
          </select>
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
