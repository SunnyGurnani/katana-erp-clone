"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";

export default function WebhooksPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();

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

      <Modal open={whOpen} onClose={() => setWhOpen(false)} title="New Webhook">
        <div className="space-y-3">
          <div><label className="label">Endpoint URL</label><input className="input" type="url" value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://..." /></div>
          <div><label className="label">Events (comma separated)</label><input className="input" value={whEvents} onChange={e => setWhEvents(e.target.value)} placeholder="po.received, so.fulfilled" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setWhOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={createWh.isPending || !whUrl} onClick={() => createWh.mutate()}>{createWh.isPending ? "Creating..." : "Create"}</button>
        </div>
      </Modal>
    </div>
  );
}
