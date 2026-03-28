"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Plus, Truck, Trash2, Copy, Save, FileDown, X } from "lucide-react";
import Link from "next/link";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { productVariantOptions, locationOptions, customerOptions } from "@/lib/catalogOptions";
import { formatLocalDateDisplay, formatLocalDateYmd } from "@/lib/formatDate";

export default function SODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [rowOpen, setRowOpen] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [fulfillLocationId, setFulfillLocationId] = useState("");
  const [editForm, setEditForm] = useState({ status: "", dueAt: "", notes: "", customerId: "", currency: "USD" });
  const [fulfillError, setFulfillError] = useState("");

  const { data: so, isLoading } = useQuery({ queryKey: ["so", id], queryFn: () => api.get(`/sales-orders/${id}`).then(r => r.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const variantOpts = useMemo(() => productVariantOptions(products), [products]);
  const locOpts = useMemo(() => locationOptions(locations), [locations]);
  const custOpts = useMemo(() => customerOptions(customers), [customers]);
  const variantById = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => (p.variants || []).forEach((v: any) => map.set(v.id, { ...v, product: p })));
    return map;
  }, [products]);

  const addRow = useMutation({
    mutationFn: () => api.post(`/sales-orders/${id}/rows`, {
      variantId: variantId || undefined,
      qty: Number(qty),
      salePrice: salePrice === "" ? undefined : Number(salePrice),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", id] }); addToast("Row added", "success"); setRowOpen(false); setVariantId(""); setQty(""); setSalePrice(""); },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.issues?.[0]?.message ||
        "Error adding row";
      addToast(typeof msg === "string" ? msg : "Error adding row", "error");
    },
  });

  const fulfill = useMutation({
    mutationFn: () =>
      api.post(`/sales-orders/${id}/fulfill`, {
        locationId: fulfillLocationId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["so", id] });
      addToast("Order fulfilled", "success");
      setFulfillOpen(false);
      setFulfillError("");
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ||
        (Array.isArray(err?.response?.data?.issues) && err.response.data.issues[0]?.message) ||
        "Error fulfilling order";
      addToast(typeof msg === "string" ? msg : "Error fulfilling order", "error");
    },
  });

  const revertFulfillment = useMutation({
    mutationFn: () => api.post(`/sales-orders/${id}/revert-fulfillment`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["so", id] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      addToast("Fulfillment reverted; stock restored.", "success");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Could not revert fulfillment";
      addToast(typeof msg === "string" ? msg : "Could not revert fulfillment", "error");
    },
  });

  const updateSO = useMutation({
    mutationFn: (d: any) => api.patch(`/sales-orders/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", id] }); addToast("Updated", "success"); setEditOpen(false); },
    onError: () => addToast("Error updating SO", "error"),
  });

  const deleteSO = useMutation({
    mutationFn: () => api.delete(`/sales-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Deleted", "success"); router.push("/dashboard/sell"); },
    onError: () => addToast("Error deleting SO", "error"),
  });

  const duplicateSO = useMutation({
    mutationFn: () => api.post(`/sales-orders/${id}/duplicate`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Duplicated", "success"); router.push(`/dashboard/sell/${res.data.id || res.data.data?.id || ""}`); },
    onError: () => addToast("Error duplicating SO", "error"),
  });

  const deleteRow = useMutation({
    mutationFn: (rowId: string) => api.delete(`/sales-order-rows/${rowId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", id] }); addToast("Row removed", "success"); },
    onError: () => addToast("Error removing row", "error"),
  });

  function downloadPdf() {
    api.get(`/pdf/sales-order/${id}`, { responseType: "blob" }).then(res => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `SO-${so?.soNumber || id}.pdf`; a.click(); URL.revokeObjectURL(url);
    }).catch(() => addToast("Error downloading PDF", "error"));
  }

  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={6} /></tbody></table></div>;
  if (!so) return <div className="p-6 text-gray-500">SO not found.</div>;

  const st = String(so.status || "").toLowerCase();
  const hasLines = (so.rows?.length ?? 0) > 0;
  const canFulfill = hasLines && ["confirmed", "partial", "sent"].includes(st);
  const hasOutboundFulfillment = (so.rows || []).some((r: any) => Number(r.fulfilledQty || 0) > 0);
  const canRevertFulfillment =
    hasOutboundFulfillment && (st === "fulfilled" || st === "partial");

  const statusEditOptions = hasOutboundFulfillment
    ? ["partial", "fulfilled", "cancelled"]
    : ["draft", "confirmed", "partial", "fulfilled", "cancelled"];

  function openEditModal() {
    setEditForm({
      status: so.status || "",
      dueAt: so.dueAt ? formatLocalDateYmd(so.dueAt) : "",
      notes: so.notes || "",
      customerId: so.customer?.id || "",
      currency: so.currency || "USD",
    });
    setEditOpen(true);
  }

  function onVariantPick(nextId: string) {
    setVariantId(nextId);
    const v = variantById.get(nextId);
    if (!v) {
      setSalePrice("");
      return;
    }
    const p =
      v.salesPrice != null && v.salesPrice !== ""
        ? String(v.salesPrice)
        : v.product?.salesPrice != null && v.product?.salesPrice !== ""
          ? String(v.product.salesPrice)
          : "";
    setSalePrice(p);
  }

  function submitAddRow() {
    if (!variantId) {
      addToast("Select a product.", "error");
      return;
    }
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      addToast("Quantity must be greater than 0.", "error");
      return;
    }
    addRow.mutate();
  }

  function submitFulfill() {
    const loc = fulfillLocationId || so.locationId;
    if (!loc) {
      setFulfillError("Select a ship-from location (or set a default location on the order).");
      addToast("Select a ship-from location.", "error");
      return;
    }
    setFulfillError("");
    fulfill.mutate();
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/sell" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">SO {so.soNumber}</h1>
          <p className="text-sm text-gray-500">{so.customer?.name || "No customer"}</p>
        </div>
        <StatusBadge status={so.status} />
        <button className="btn btn-ghost text-sm" onClick={downloadPdf}><FileDown size={14} />PDF</button>
        <button className="btn btn-ghost text-sm" onClick={openEditModal}><Save size={14} />Edit</button>
        <button className="btn btn-ghost text-sm" onClick={() => duplicateSO.mutate()}><Copy size={14} />Duplicate</button>
        <button
          type="button"
          className="btn btn-ghost text-sm text-red-600"
          onClick={() => {
            if (hasOutboundFulfillment) {
              addToast("Revert fulfillment before deleting this order.", "error");
              return;
            }
            if (window.confirm("Delete this sales order? This cannot be undone.")) deleteSO.mutate();
          }}
        >
          <Trash2 size={14} />Delete
        </button>
        {canFulfill && <button type="button" className="btn btn-primary" onClick={() => { setFulfillError(""); setFulfillOpen(true); }}><Truck size={15} />Fulfill</button>}
        {canRevertFulfillment && (
          <button
            type="button"
            className="btn btn-ghost text-sm text-amber-800 border border-amber-200"
            disabled={revertFulfillment.isPending}
            onClick={() => {
              if (window.confirm("Revert fulfillment? On-hand stock will be increased by the quantities that were shipped.")) revertFulfillment.mutate();
            }}
          >
            Revert fulfillment
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Due</p><p className="font-medium">{so.dueAt ? formatLocalDateDisplay(so.dueAt) : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Total</p><p className="font-semibold">${Number(so.totalPrice || 0).toFixed(2)}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Lines</p><p className="font-medium">{so.rows?.length || 0}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Notes</p><p className="truncate">{so.notes || "—"}</p></div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Line Items</h2>
          {["draft", "confirmed"].includes(so.status) && (
            <button className="btn btn-ghost text-sm" onClick={() => setRowOpen(true)}><Plus size={14} />Add Row</button>
          )}
        </div>
        <table className="table">
          <thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Sale Price</th><th>Fulfilled</th><th>Line Total</th><th></th></tr></thead>
          <tbody>
            {(so.rows || []).map((r: any) => (
              <tr key={r.id}>
                {(() => {
                  const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
                  return (
                    <>
                      <td className="font-mono text-sm">{v?.sku || "—"}</td>
                      <td>{v?.product?.name || r.description || r.variantId || "—"}</td>
                    </>
                  );
                })()}
                <td>{r.qty}</td>
                <td>{Number(r.salePrice || 0).toFixed(2)} {so.currency || "USD"}</td>
                <td>{r.fulfilledQty || 0}</td>
                <td>{(Number(r.qty) * Number(r.salePrice || 0)).toFixed(2)} {so.currency || "USD"}</td>
                <td>{["draft", "confirmed"].includes(so.status) && <button className="icon-btn text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); if (window.confirm("Remove this row?")) deleteRow.mutate(r.id); }}><X size={14} /></button>}</td>
              </tr>
            ))}
            {!so.rows?.length && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No line items yet</td></tr>}
          </tbody>
        </table>
      </div>

      {Array.isArray(so.fulfillments) && so.fulfillments.filter((f: any) => !f.isReturn).length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Fulfillment history</h2>
            <p className="text-xs text-gray-500 mt-0.5">Outbound shipments recorded for this order</p>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Location</th>
                <th>Qty</th>
                <th>Line</th>
              </tr>
            </thead>
            <tbody>
              {so.fulfillments
                .filter((f: any) => !f.isReturn)
                .map((f: any) => {
                  const line = (so.rows || []).find((r: any) => r.id === f.rowId);
                  const v = line?.variant || (line?.variantId ? variantById.get(line.variantId) : undefined);
                  const lineLabel = v?.product?.name || line?.description || f.rowId?.slice(0, 8) || "—";
                  return (
                    <tr key={f.id}>
                      <td className="text-sm text-gray-700">{formatLocalDateDisplay(f.createdAt)}</td>
                      <td className="text-sm">{f.location?.name || "—"}</td>
                      <td className="font-medium">{Number(f.qty)}</td>
                      <td className="text-sm text-gray-600">{lineLabel}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={rowOpen} onClose={() => setRowOpen(false)} title="Add Line Item">
        <div className="space-y-3">
          <div>
            <label className="label">Product</label>
            <SearchableSelect
              value={variantId}
              onChange={onVariantPick}
              options={variantOpts}
              placeholder="Search products…"
              emptyOptionLabel="— Select —"
              aria-label="Product variant"
            />
          </div>
          <div><label className="label">Qty</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Sale Price</label><input className="input" type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setRowOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={addRow.isPending} onClick={submitAddRow}>{addRow.isPending ? "Adding..." : "Add"}</button>
        </div>
      </Modal>

      <Modal open={fulfillOpen} onClose={() => { setFulfillOpen(false); setFulfillError(""); }} title="Fulfill Order">
        <div className="space-y-3">
          <div>
            <label className="label">Ship from location</label>
            <SearchableSelect
              value={fulfillLocationId}
              onChange={(v) => { setFulfillLocationId(v); setFulfillError(""); }}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel={so.locationId ? "— Use order default —" : "— Select —"}
              aria-label="Fulfill from location"
            />
          </div>
          {fulfillError && <p className="text-sm text-red-600">{fulfillError}</p>}
          <p className="text-xs text-gray-500">
            Stock will be deducted from the selected location
            {so.locationId ? " (or the order's default if you leave this empty)." : "."}
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={() => { setFulfillOpen(false); setFulfillError(""); }}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={fulfill.isPending} onClick={submitFulfill}>{fulfill.isPending ? "Fulfilling..." : "Confirm Fulfill"}</button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Sales Order">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <SearchableSelect
              value={editForm.customerId}
              onChange={(v) => setEditForm((f) => ({ ...f, customerId: v }))}
              options={custOpts}
              placeholder="Search customers…"
              emptyOptionLabel="— Select —"
              aria-label="Customer"
            />
          </div>
          <div>
            <label className="label">Currency</label>
            <input className="input" value={editForm.currency} onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 8) }))} maxLength={8} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {statusEditOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {hasOutboundFulfillment && (
              <p className="text-xs text-amber-800 mt-1">Status is limited while lines have fulfilled quantity. Use Revert fulfillment to go back to draft/confirmed.</p>
            )}
          </div>
          <div><label className="label">Due Date</label><input className="input" type="date" value={editForm.dueAt} onChange={e => setEditForm(f => ({ ...f, dueAt: e.target.value }))} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={updateSO.isPending}
            onClick={() =>
              updateSO.mutate({
                customerId: editForm.customerId ? editForm.customerId : null,
                currency: editForm.currency || undefined,
                status: editForm.status || undefined,
                dueAt: editForm.dueAt || null,
                notes: editForm.notes,
              })
            }
          >
            {updateSO.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
