"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", currency: "USD" });

  const { data: customer, isLoading } = useQuery({ queryKey: ["customer", id], queryFn: () => api.get(`/customers/${id}`).then(r => r.data) });
  const { data: orders } = useQuery({
    queryKey: ["customer-orders", id],
    queryFn: () => api.get("/sales-orders", { params: { customerId: id } }).then(r => r.data.data),
  });

  const update = useMutation({
    mutationFn: (d: any) => api.put(`/customers/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer", id] }); qc.invalidateQueries({ queryKey: ["customers"] }); addToast("Saved", "success"); setEditOpen(false); },
    onError: () => addToast("Error saving", "error"),
  });

  const deleteCustomer = useMutation({
    mutationFn: () => api.delete(`/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); addToast("Deleted", "success"); router.push("/dashboard/sell/customers"); },
    onError: () => addToast("Error deleting", "error"),
  });

  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={6} /></tbody></table></div>;
  if (!customer) return <div className="p-6 text-gray-500">Customer not found.</div>;

  function openEdit() {
    setForm({ name: customer.name || "", email: customer.email || "", phone: customer.phone || "", address: customer.address || "", currency: customer.currency || "USD" });
    setEditOpen(true);
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-start gap-3">
        <Link href="/dashboard/sell/customers" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">Customer</p>
          <h1 className="text-xl font-semibold text-gray-900 truncate">{customer.name}</h1>
        </div>
        <button className="btn btn-ghost text-sm h-9" onClick={openEdit}><Save size={14} />Edit</button>
        <button className="btn btn-ghost text-sm h-9 text-red-600" onClick={() => { if (window.confirm("Delete this customer?")) deleteCustomer.mutate(); }}><Trash2 size={14} />Delete</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Code</p><p className="font-medium text-sm">{customer.code || "---"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Email</p><p className="font-medium text-sm">{customer.email || "---"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Phone</p><p className="font-medium text-sm">{customer.phone || "---"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Currency</p><p className="font-medium text-sm">{customer.currency || "USD"}</p></div>
      </div>

      {customer.address && (
        <div className="card p-4">
          <p className="text-gray-500 text-xs mb-1">Address</p>
          <p className="text-sm text-gray-700">{customer.address}</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Sales Orders</h2>
        </div>
        <table className="table">
          <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
          <tbody>
            {(orders || []).map((o: any) => (
              <tr key={o.id}>
                <td><Link href={`/dashboard/sell/${o.id}`} className="text-brand-600 font-medium hover:underline">{o.soNumber}</Link></td>
                <td><StatusBadge status={o.status} /></td>
                <td className="font-medium">${Number(o.totalPrice || 0).toFixed(2)}</td>
                <td className="text-gray-500 text-sm">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!(orders || []).length && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No orders found</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer">
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={update.isPending} onClick={() => update.mutate(form)}>{update.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
