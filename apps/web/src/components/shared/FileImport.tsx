"use client";
import { useRef, useState } from "react";
import { Upload, FileDown } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Props {
  entity: string;
  onSuccess?: () => void;
}

export function FileImport({ entity, onSuccess }: Props) {
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity", entity);
      const res = await api.post("/data/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      addToast(`Imported ${res.data.created} rows${res.data.errors ? `, ${res.data.errors} errors` : ""}`, res.data.errors ? "error" : "success");
      onSuccess?.();
    } catch {
      addToast("Import failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".csv,.json,.xlsx" className="hidden" onChange={handleFile} />
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <Upload size={12} />
        <span>{uploading ? "Importing..." : "Import"}</span>
      </button>
    </div>
  );
}
