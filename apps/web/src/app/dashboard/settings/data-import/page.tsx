"use client";
import { FileImport } from "@/components/shared/FileImport";
import { Download, Database, Package, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function DataImportPage() {
  const { addToast } = useToast();
  const importTypes = [
    { id: "customers", label: "Customers", desc: "Import your customer list and contact details.", icon: Users, color: "bg-blue-100 text-blue-700" },
    { id: "products", label: "Products", desc: "Import product items, variants, and base pricing.", icon: Package, color: "bg-emerald-100 text-emerald-700" },
    { id: "materials", label: "Materials", desc: "Import raw materials and components.", icon: Database, color: "bg-purple-100 text-purple-700" },
  ];

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
    <div className="px-8 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Data Import</h1>
        <p className="text-sm text-gray-500 mt-1">Import your existing data into ForgeERP using CSV files.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {importTypes.map((type) => (
          <div key={type.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-lg ${type.color}`}>
                <type.icon size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{type.label}</h3>
                <p className="text-xs text-gray-500 mt-1">{type.desc}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
              <button
                type="button"
                className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
                onClick={() => downloadTemplate(type.id)}
              >
                <Download size={14} /> Template
              </button>
              <div className="scale-90 origin-right">
                <FileImport entity={type.id} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
