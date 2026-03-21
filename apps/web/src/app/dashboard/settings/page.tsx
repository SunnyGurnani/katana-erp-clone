"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, Copy } from "lucide-react";

type Tab = "api-keys" | "webhooks";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("api-keys");
  const qc = useQueryClient();
  const { addToast } = useToast();

  // API Keys
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const { data: keys, isLoading: keysLoading } = useQuery({ queryKey: ["api-keys"], queryFn: () => api.get("/api-keys").then(r => r.data.data) });
  const createKey = useMutation({
    mutationFn: () => api.post("/api-keys", { name: keyName }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["api-keys"] }); setNewKey(res.data.plainKey || ""); addToast("API key created", "success"); setKeyName(""); },
    onError: () => addToast("Error creating key", "error"),
  });
  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); addToast("Key deleted", "success"); },
  });

  // Webhooks
  const [whOpen, setWhOpen] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState("");
  const { data: webhooks, isLoading: whLoading } = useQuery({ queryKey: ["webhooks"], queryFn: () => api.get("/webhooks").then(r => r.data.data) });
  const createWh = useMutation({
    mutationFn: () => api.post("/webhooks", { url: whUrl, events: whEvents.split(",").map(s => s.trim()).filter(Boolean) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); addToast("Webhook created", "success"); setWhOpen(false); setWhUrl(""); setWhEvents(""); },
    onError: () => addToast("Error creating webhook", "error"),
  });
  const deleteWh = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); addToast("Webhook deleted", "success"); },
  });

  return (
    <div className="px-4 py-3 space-y-4">
      <div><h1 className="text-2xl font-bold text-gray-900">Settings</h1><p className="text-sm text-gray-500">API keys & integrations</p></div>

      <div className="flex gap-1 border-b border-gray-200">
        {(["api-keys", "webhooks"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "api-keys" ? "API Keys" : "Webhooks"}
          </button>
        ))}
      </div>

      {tab === "api-keys" && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold">API Keys</h2>
            <button className="btn btn-primary text-sm" onClick={() => setKeyOpen(true)}><Plus size={14} className="mr-1" />New Key</button>
          </div>
          {keysLoading ? <SkeletonRows rows={4} /> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last Used</th><th></th></tr></thead>
              <tbody>
                {(keys || []).map((k: any) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.name}</td>
                    <td className="font-mono text-sm">{k.prefix}…</td>
                    <td className="text-gray-500 text-sm">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="text-gray-500 text-sm">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                    <td><button className="icon-btn text-red-400" onClick={() => deleteKey.mutate(k.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {!keys?.length && <tr><td colSpan={5} className="text-center text-gray-400 py-8">No API keys</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "webhooks" && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold">Webhooks</h2>
            <button className="btn btn-primary text-sm" onClick={() => setWhOpen(true)}><Plus size={14} className="mr-1" />New Webhook</button>
          </div>
          {whLoading ? <SkeletonRows rows={4} /> : (
            <table className="table">
              <thead><tr><th>URL</th><th>Events</th><th>Active</th><th></th></tr></thead>
              <tbody>
                {(webhooks || []).map((w: any) => (
                  <tr key={w.id}>
                    <td className="font-mono text-sm truncate max-w-xs">{w.url}</td>
                    <td><div className="flex flex-wrap gap-1">{(w.events || []).map((e: string) => <span key={e} className="badge">{e}</span>)}</div></td>
                    <td><span className={`badge ${w.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{w.active ? "Active" : "Inactive"}</span></td>
                    <td><button className="icon-btn text-red-400" onClick={() => deleteWh.mutate(w.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {!webhooks?.length && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No webhooks</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New API Key modal */}
      <Modal open={keyOpen} onClose={() => { setKeyOpen(false); setNewKey(""); }} title="New API Key">
        {newKey ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Copy your key now — it won't be shown again.</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 font-mono text-sm break-all">
              {newKey}
              <button className="ml-auto icon-btn shrink-0" onClick={() => { navigator.clipboard.writeText(newKey); addToast("Copied!", "success"); }}><Copy size={14} /></button>
            </div>
            <button className="btn btn-primary w-full" onClick={() => { setKeyOpen(false); setNewKey(""); }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div><label className="label">Key Name</label><input className="input" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="e.g. CI Integration" /></div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-ghost" onClick={() => setKeyOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={createKey.isPending || !keyName} onClick={() => createKey.mutate()}>{createKey.isPending ? "Creating…" : "Create"}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Webhook modal */}
      <Modal open={whOpen} onClose={() => setWhOpen(false)} title="New Webhook">
        <div className="space-y-3">
          <div><label className="label">Endpoint URL</label><input className="input" type="url" value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://…" /></div>
          <div><label className="label">Events (comma separated)</label><input className="input" value={whEvents} onChange={e => setWhEvents(e.target.value)} placeholder="po.received, so.fulfilled" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setWhOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={createWh.isPending || !whUrl} onClick={() => createWh.mutate()}>{createWh.isPending ? "Creating…" : "Create"}</button>
        </div>
      </Modal>
    </div>
  );
}
