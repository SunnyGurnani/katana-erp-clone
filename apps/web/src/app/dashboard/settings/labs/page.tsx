"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { FlaskConical } from "lucide-react";

type LabsSettings = {
  shopFloorBeta: boolean;
  advancedPlanning: boolean;
  batchBarcodeScan: boolean;
};

const FLAGS: { key: keyof LabsSettings; label: string; desc: string }[] = [
  { key: "shopFloorBeta", label: "Shop floor app", desc: "Enable the shop floor production view." },
  { key: "advancedPlanning", label: "Advanced planning", desc: "Extra planning columns and demand forecast overlays." },
  { key: "batchBarcodeScan", label: "Batch barcode scan", desc: "Scan multiple barcodes in one session on stock pages." },
];

export default function LabsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["labs-settings"],
    queryFn: () => api.get("/app-settings/labs").then((r) => r.data as LabsSettings),
  });

  const save = useMutation({
    mutationFn: (patch: Partial<LabsSettings>) => api.patch("/app-settings/labs", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labs-settings"] });
      addToast("Labs settings saved", "success");
    },
    onError: () => addToast("Could not save", "error"),
  });

  function toggle(key: keyof LabsSettings) {
    if (!data) return;
    save.mutate({ [key]: !data[key] });
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-2xl">
      <header className="flex items-start gap-3">
        <FlaskConical className="text-brand-600 mt-0.5" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Labs</h1>
          <p className="text-sm text-gray-500 mt-1">Experimental features that may change without notice.</p>
        </div>
      </header>

      <div className="card divide-y divide-gray-100">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          FLAGS.map((f) => (
            <label key={f.key} className="flex items-start gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50/80">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-300"
                checked={Boolean(data?.[f.key])}
                disabled={save.isPending}
                onChange={() => toggle(f.key)}
              />
              <span>
                <span className="text-sm font-medium text-gray-900 block">{f.label}</span>
                <span className="text-xs text-gray-500">{f.desc}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
