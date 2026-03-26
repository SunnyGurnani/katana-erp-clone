"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  purchaseLineOptions,
  parsePurchaseLineValue,
  locationOptions,
  supplierOptions,
} from "@/lib/catalogOptions";
import { ArrowLeft, PackageCheck, Save, Trash2, FileDown, X, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [editForm, setEditForm] = useState({ status: "", expectedAt: "", notes: "" });
  const [newLine, setNewLine] = useState({ itemValue: "", qty: "1", unitCost: "" });

  const { data: po, isLoading } = useQuery({ queryKey: ["po", id], queryFn: () => api.get(`/purchase-orders/${id}`).then((r) => r.data) });
  const { data: materials } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then((r) => r.data.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then((r) => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then((r) => r.data.data) });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then((r) => r.data.data) });
  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: () => api.get("/currencies").then((r) => r.data.data) });

  const lineOptions = useMemo(() => purchaseLineOptions(materials, products), [materials, products]);
  const locOpts = useMemo(() => locationOptions(locations), [locations]);
  const supOpts = useMemo(() => supplierOptions(suppliers), [suppliers]);
  const currencyOpts = useMemo(() => {
    const fromApi = (currencies || []).map((c: any) => ({
      value: c.code,
      label: c.isBase ? `${c.code} (Base) — ${c.name}` : `${c.code} — ${c.name}`,
    }));
    const codes = new Set(fromApi.map((o: { value: string }) => o.value));
    if (po?.currency && !codes.has(po.currency)) {
      return [{ value: po.currency, label: po.currency }, ...fromApi];
    }
    return fromApi.length ? fromApi : [{ value: "USD", label: "USD — US Dollar" }];
  }, [currencies, po?.currency]);

  const addRow = useMutation({
    mutationFn: () => {
      const { variantId, materialId } = parsePurchaseLineValue(newLine.itemValue);
      return api.post(`/purchase-orders/${id}/rows`, {
        variantId: variantId ?? undefined,
        materialId: materialId ?? undefined,
        qty: Number(newLine.qty) || 1,
        unitCost: newLine.unitCost === "" ? undefined : Number(newLine.unitCost),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po", id] });
      addToast("Line added", "success");
      setNewLine({ itemValue: "", qty: "1", unitCost: "" });
    },
    onError: () => addToast("Error adding row", "error"),
  });

  const receive = useMutation({
    mutationFn: () =>
      api.post(`/purchase-orders/${id}/receive`, {
        locationId: receiveLocationId,
        rows: (po?.rows || []).map((r: any) => ({ rowId: r.id, receivedQty: Number(r.qty) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po", id] });
      addToast("Stock received", "success");
      setReceiveOpen(false);
    },
    onError: () => addToast("Error receiving stock", "error"),
  });

  const updatePO = useMutation({
    mutationFn: (d: any) => api.patch(`/purchase-orders/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po", id] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: () => addToast("Error updating PO", "error"),
  });

  const deletePO = useMutation({
    mutationFn: () => api.delete(`/purchase-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      addToast("Deleted", "success");
      router.push("/dashboard/buy");
    },
    onError: () => addToast("Error deleting PO", "error"),
  });

  const deleteRow = useMutation({
    mutationFn: (rowId: string) => api.delete(`/purchase-order-rows/${rowId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po", id] });
      addToast("Row removed", "success");
    },
    onError: () => addToast("Error removing row", "error"),
  });

  function downloadPdf() {
    api
      .get(`/pdf/purchase-order/${id}`, { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PO-${po?.poNumber || id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => addToast("Error downloading PDF", "error"));
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <table className="table">
          <tbody>
            <SkeletonRows rows={6} />
          </tbody>
        </table>
      </div>
    );
  }
  if (!po) return <div className="p-6 text-gray-500">PO not found.</div>;

  const canReceive = ["draft", "sent", "partial"].includes(po.status);
  const canEditLines = ["draft", "sent"].includes(po.status);
  const canEditHeader = ["draft", "sent", "partial"].includes(po.status);

  const subtotal =
    (po.rows || []).reduce((s: number, r: any) => s + Number(r.qty) * Number(r.unitCost || 0), 0) ?? 0;
  const totalUnits = (po.rows || []).reduce((s: number, r: any) => s + Number(r.qty || 0), 0);

  function openEditModal() {
    setEditForm({
      status: po.status || "",
      expectedAt: po.expectedAt ? po.expectedAt.slice(0, 10) : "",
      notes: po.notes || "",
    });
    setEditOpen(true);
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-start gap-3">
        <Link href="/dashboard/buy" className="icon-btn">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">Purchase order</p>
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {po.poNumber}
            {po.supplier?.name ? <span className="text-gray-700 font-medium"> {po.supplier.name}</span> : null}
          </h1>
        </div>
        <div className="pt-0.5">
          <StatusBadge status={po.status} />
        </div>
        <button className="btn btn-ghost text-sm h-9" onClick={downloadPdf}>
          <FileDown size={14} />
          PDF
        </button>
        <button className="btn btn-ghost text-sm h-9" onClick={openEditModal}>
          <Save size={14} />
          Edit
        </button>
        <button
          className="btn btn-ghost text-sm h-9 text-red-600"
          onClick={() => {
            if (window.confirm("Delete this purchase order?")) deletePO.mutate();
          }}
        >
          <Trash2 size={14} />
          Delete
        </button>
        {canReceive && (
          <button className="btn btn-primary h-9" onClick={() => setReceiveOpen(true)}>
            <PackageCheck size={15} />
            Receive
          </button>
        )}
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Order details</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="label">Supplier</label>
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={po.supplier?.id || ""}
                  onChange={(v) => updatePO.mutate({ supplierId: v || null })}
                  options={supOpts}
                  placeholder="Search suppliers…"
                  emptyOptionLabel="— No supplier —"
                  disabled={!canEditHeader || updatePO.isPending}
                  aria-label="Supplier"
                />
              </div>
              {po.supplier?.id && (
                <Link href="/dashboard/buy/suppliers" className="icon-btn mt-1 shrink-0" title="Suppliers">
                  <ExternalLink size={16} />
                </Link>
              )}
            </div>
          </div>
          <div>
            <label className="label">Expected arrival</label>
            <input
              className="input"
              type="date"
              disabled={!canEditHeader || updatePO.isPending}
              value={po.expectedAt ? po.expectedAt.slice(0, 10) : ""}
              onChange={(e) => updatePO.mutate({ expectedAt: e.target.value || null })}
            />
          </div>
          <div>
            <label className="label">Created</label>
            <input
              className="input bg-gray-50 text-gray-600"
              readOnly
              value={po.createdAt ? new Date(po.createdAt).toISOString().slice(0, 10) : "—"}
            />
          </div>
          <div>
            <label className="label">Order #</label>
            <input className="input bg-gray-50 text-gray-600" readOnly value={po.poNumber || "—"} />
          </div>
          <div>
            <label className="label">Order currency</label>
            <SearchableSelect
              value={po.currency || "USD"}
              onChange={(code) => updatePO.mutate({ currency: code })}
              options={currencyOpts.length ? currencyOpts : [{ value: "USD", label: "USD — US Dollar" }]}
              placeholder="Search currency…"
              disabled={!canEditHeader || updatePO.isPending}
              aria-label="Currency"
            />
          </div>
          <div>
            <label className="label">Ship to</label>
            <SearchableSelect
              value={po.locationId || ""}
              onChange={(v) => updatePO.mutate({ locationId: v || null })}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel="— Select location —"
              disabled={!canEditHeader || updatePO.isPending}
              aria-label="Ship to location"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Items not received</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit cost</th>
                <th>Line total</th>
                <th>Received</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {(po.rows || []).map((r: any, i: number) => (
                <tr key={r.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td>
                    <span className="font-medium text-gray-900">
                      {r.variant?.sku ? `[${r.variant.sku}] ` : ""}
                      {r.variant?.product?.name || r.variant?.material?.name || r.description || "—"}
                      {r.variant?.name && r.variant?.product ? ` / ${r.variant.name}` : ""}
                    </span>
                  </td>
                  <td>{r.qty}</td>
                  <td className="whitespace-nowrap">
                    {Number(r.unitCost || 0).toFixed(4)} {po.currency || "USD"}
                  </td>
                  <td className="font-medium whitespace-nowrap">
                    {(Number(r.qty) * Number(r.unitCost || 0)).toFixed(2)} {po.currency || "USD"}
                  </td>
                  <td>{r.qtyReceived ?? r.receivedQty ?? 0}</td>
                  <td>
                    {canEditLines && (
                      <button
                        className="icon-btn text-red-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Remove this row?")) deleteRow.mutate(r.id);
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {canEditLines && (
                <tr className="bg-gray-50/80">
                  <td className="text-gray-400">+</td>
                  <td colSpan={1} className="min-w-[240px]">
                    <SearchableSelect
                      value={newLine.itemValue}
                      onChange={(v) => setNewLine((n) => ({ ...n, itemValue: v }))}
                      options={lineOptions}
                      placeholder="Search materials & products…"
                      emptyOptionLabel="— Select item —"
                      aria-label="New line item"
                    />
                  </td>
                  <td>
                    <input
                      className="input py-1.5"
                      type="number"
                      min={0}
                      step="any"
                      value={newLine.qty}
                      onChange={(e) => setNewLine((n) => ({ ...n, qty: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      className="input py-1.5"
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={newLine.unitCost}
                      onChange={(e) => setNewLine((n) => ({ ...n, unitCost: e.target.value }))}
                    />
                  </td>
                  <td className="text-gray-400 text-sm">—</td>
                  <td />
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary text-xs py-1.5 px-2"
                      disabled={addRow.isPending || !newLine.itemValue}
                      onClick={() => addRow.mutate()}
                    >
                      {addRow.isPending ? "…" : "Add"}
                    </button>
                  </td>
                </tr>
              )}
              {!po.rows?.length && !canEditLines && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-end gap-1 border-t border-gray-100 px-5 py-4 text-sm">
          <div className="flex w-full max-w-[260px] justify-between text-gray-600">
            <span>Total units</span>
            <span className="font-medium text-gray-900">{totalUnits}</span>
          </div>
          <div className="flex w-full max-w-[260px] justify-between text-gray-600">
            <span>Subtotal (tax excluded)</span>
            <span className="font-medium text-gray-900">
              {subtotal.toFixed(2)} {po.currency || "USD"}
            </span>
          </div>
          <div className="flex w-full max-w-[260px] justify-between text-base font-semibold text-gray-900 pt-1 border-t border-gray-200">
            <span>Total</span>
            <span>
              {subtotal.toFixed(2)} {po.currency || "USD"}
            </span>
          </div>
        </div>
      </div>

      {po.costRows && po.costRows.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Additional costs</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(po.costRows as any[]).map((c: any) => (
                <tr key={c.id}>
                  <td>{c.description}</td>
                  <td className="font-medium">
                    {Number(c.amount || 0).toFixed(2)} {po.currency || "USD"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive Stock">
        <div className="space-y-3">
          <div>
            <label className="label">Destination location</label>
            <SearchableSelect
              value={receiveLocationId}
              onChange={setReceiveLocationId}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel="— Select —"
              aria-label="Receive location"
            />
          </div>
          <p className="text-xs text-gray-500">Outstanding quantities will be received into this location.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setReceiveOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={receive.isPending || !receiveLocationId} onClick={() => receive.mutate()}>
            {receive.isPending ? "Receiving…" : "Confirm receive"}
          </button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit purchase order">
        <div className="space-y-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
              {["draft", "sent", "partial", "received", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Expected date</label>
            <input className="input" type="date" value={editForm.expectedAt} onChange={(e) => setEditForm((f) => ({ ...f, expectedAt: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={updatePO.isPending} onClick={() => updatePO.mutate(editForm)}>
            {updatePO.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
