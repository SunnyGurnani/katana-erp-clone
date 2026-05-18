"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SkeletonRows } from "@/components/ui/Skeleton";

export default function BarcodesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [skuAsBarcode, setSkuAsBarcode] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["barcode-settings"],
    queryFn: () => api.get("/barcodes").then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled ?? true);
      setSkuAsBarcode(data.skuAsBarcode ?? false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.patch("/barcodes", { enabled, skuAsBarcode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["barcode-settings"] });
      addToast("Barcode settings saved", "success");
    },
    onError: () => addToast("Could not save barcode settings", "error"),
  });

  if (isLoading) {
    return (
      <div className="px-8 py-6 max-w-3xl">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 max-w-3xl page-transition">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Barcodes</h1>
        <p className="text-sm text-gray-500 mt-1">Manage barcode settings for items, batches, and operations.</p>
      </div>

      <div className="card">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Enable Barcodes</h2>
              <p className="text-sm text-gray-500 mt-1">Allow scanning barcodes in the Shop Floor App and Warehouse views.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
            </label>
          </div>
        </div>

        {enabled && (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">Use SKU as fallback barcode</h3>
                <p className="text-xs text-gray-500 mt-1">If an item doesn&apos;t have a specific barcode, the system will recognize its SKU when scanned.</p>
              </div>
              <input
                type="checkbox"
                checked={skuAsBarcode}
                onChange={(e) => setSkuAsBarcode(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
