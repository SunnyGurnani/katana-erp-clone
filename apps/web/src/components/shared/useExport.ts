"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export function useExport() {
  const [exporting, setExporting] = useState(false);

  async function exportData(entity: string, format: "csv" | "xlsx" = "csv", filters?: Record<string, any>, ids?: string[]) {
    setExporting(true);
    try {
      const res = await api.post("/data/export", { entity, format, filters, ids }, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return { exportData, exporting };
}
