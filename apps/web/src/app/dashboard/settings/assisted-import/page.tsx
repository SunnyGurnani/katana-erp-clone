"use client";

import Link from "next/link";
import { FileImport } from "@/components/shared/FileImport";
import { Download, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const STEPS = [
  { n: 1, title: "Download template", desc: "Get a CSV with the correct columns for your entity type." },
  { n: 2, title: "Fill in your data", desc: "Use Excel or Google Sheets. Keep SKU and name columns filled." },
  { n: 3, title: "Upload CSV", desc: "Import validates rows and reports errors per line." },
];

const ENTITIES = [
  { id: "customers", label: "Customers" },
  { id: "products", label: "Products" },
  { id: "materials", label: "Materials" },
];

export default function AssistedImportPage() {
  const { addToast } = useToast();

  async function downloadTemplate(entity: string) {
    try {
      const res = await api.get(`/data/templates/${entity}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}-import-template.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      addToast("Could not download template", "error");
    }
  }

  return (
    <div className="px-8 py-6 space-y-8 max-w-3xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Assisted import</h1>
        <p className="text-sm text-gray-500 mt-1">Step-by-step guide to bring your data into ForgeERP.</p>
      </header>

      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li key={s.n} className="card p-4 flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">
              {s.n}
            </span>
            <div>
              <p className="font-semibold text-gray-900">{s.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Choose what to import</h2>
        {ENTITIES.map((e) => (
          <div key={e.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium text-gray-900">{e.label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm flex items-center gap-1"
                onClick={() => downloadTemplate(e.id)}
              >
                <Download size={14} /> Template
              </button>
              <FileImport entity={e.id} />
            </div>
          </div>
        ))}
      </section>

      <p className="text-sm text-gray-500 flex items-center gap-2">
        <CheckCircle2 size={16} className="text-green-600" />
        Need bulk orders or inventory? Use
        <Link href="/dashboard/settings/data-import" className="text-brand-600 font-medium inline-flex items-center gap-0.5">
          Data import <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  );
}
