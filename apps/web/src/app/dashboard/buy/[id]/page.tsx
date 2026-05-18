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
import { ArrowLeft, PackageCheck, Save, Trash2, FileDown, X, ExternalLink, Mail, Copy } from "lucide-react";
import Link from "next/link";

const PO_STATUS_EDIT_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "vendor_confirmed", label: "Vendor confirmed" },
  { value: "vendor_rejected", label: "Vendor rejected" },
  { value: "done", label: "Done" },
];

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveRows, setReceiveRows] = useState<Record<string, { receivedQty: string; lots: { batchNumber: string; expiryDate: string; qty: string }[] }>>({});
  const [editForm, setEditForm] = useState({ status: "", expectedAt: "", notes: "" });
  const [newLine, setNewLine] = useState({ itemValue: "", qty: "1", unitCost: "" });

  const { data: po, isLoading } = useQuery({ queryKey: ["po", id], queryFn: () => api.get(`/purchase-orders/${id}`).then((r) => r.data) });
  const { data: materials } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then((r) => r.data.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then((r) => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then((r) => r.data.data) });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then((r) => r.data.data) });
  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: () => api.get("/currencies").then((r) => r.data.data) });
  const materialById = useMemo(() => {
    const map = new Map<string, any>();
    (materials || []).forEach((m: any) => map.set(m.id, m));
    return map;
  }, [materials]);
  const variantById = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => (p.variants || []).forEach((v: any) => map.set(v.id, { ...v, product: p })));
    return map;
  }, [products]);

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

  const sendToVendor = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/send-to-vendor`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["po", id] });
      const emailed = Boolean(res.data?.emailSent);
      addToast(
        emailed ? "Email sent to the supplier with the confirmation link." : "Supplier link refreshed. Configure SMTP on the API to send email automatically (link is in server logs when SMTP is off).",
        "success",
      );
    },
    onError: (err: any) => addToast(err?.response?.data?.error || "Could not send to vendor", "error"),
  });

  const receive = useMutation({
    mutationFn: () => {
      const rowsPayload = (po?.rows || [])
        .map((r: any) => {
          const state = receiveRows[r.id];
          const outstanding = lineOutstanding(r);
          const receivedQty = Math.max(
            0,
            Math.min(
              outstanding,
              Number(state?.receivedQty ?? outstanding),
            ),
          );
          if (receivedQty <= 0) return null;
          const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
          const trackLotsAndExpiry = Boolean(v?.product?.trackLotsAndExpiry);
          if (!trackLotsAndExpiry) return { rowId: r.id, receivedQty };
          const lots = (state?.lots || [])
            .map((l) => ({
              batchNumber: String(l.batchNumber || "").trim(),
              expiryDate: String(l.expiryDate || "").trim(),
              qty: Number(l.qty || 0),
            }))
            .filter((l) => l.batchNumber && l.expiryDate && l.qty > 0);
          return { rowId: r.id, receivedQty, lots };
        })
        .filter(Boolean);
      return api.post(`/purchase-orders/${id}/receive`, {
        locationId: receiveLocationId || po?.locationId || undefined,
        rows: rowsPayload,
      });
    },
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
      <div className="p-8 space-y-6 page-transition">
        <div className="flex justify-between"><div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" /><div className="h-8 w-24 bg-gray-200 rounded animate-pulse" /></div>
        <div className="grid grid-cols-4 gap-4 mt-8"><div className="h-10 bg-gray-100 rounded animate-pulse" /><div className="h-10 bg-gray-100 rounded animate-pulse" /><div className="h-10 bg-gray-100 rounded animate-pulse" /></div>
        <div className="h-64 w-full bg-gray-100 rounded animate-pulse mt-8" />
      </div>
    );
  }
  if (!po) return <div className="p-6 text-gray-500">PO not found.</div>;

  type ReceiptLine = {
    id: string;
    purchaseOrderRowId: string | null;
    variantId: string;
    qty: number;
    lotNumber: string | null;
    expiryDate: string | null;
  };

  function receiptLinesForRow(r: { id: string; variantId?: string | null }): ReceiptLine[] {
    const list = (po as { receiptLines?: ReceiptLine[] }).receiptLines;
    if (!list?.length) return [];
    return list.filter(
      (l) =>
        l.purchaseOrderRowId === r.id ||
        (!l.purchaseOrderRowId && r.variantId && l.variantId === r.variantId),
    );
  }

  function lineOutstanding(r: any): number {
    const ordered = Number(r.qty ?? r.qtyOrdered ?? 0);
    const got = Number(r.qtyReceived ?? r.receivedQty ?? 0);
    return Math.max(0, ordered - got);
  }

  function rowTracksLots(r: any): boolean {
    const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
    return Boolean(v?.product?.trackLotsAndExpiry);
  }

  const allRows = po.rows || [];
  const notReceivedRows = allRows.filter((r: any) => lineOutstanding(r) > 0);
  const receivedRows = allRows.filter((r: any) => lineOutstanding(r) <= 0 && Number(r.qty ?? r.qtyOrdered ?? 0) > 0);

  const st = String(po.status || "").toLowerCase();
  const canReceive = (st === "confirmed" || st === "vendor_confirmed") && notReceivedRows.length > 0;
  const canEditLines = ["draft", "confirmed"].includes(st);
  const canEditHeader = ["draft", "confirmed", "vendor_confirmed", "vendor_rejected"].includes(st);
  const canClosePO = ["draft", "confirmed", "vendor_confirmed", "vendor_rejected"].includes(st);
  const canSendVendorInvite = st === "confirmed" && Boolean(po.supplier?.email?.trim());
  const canConfirmFromDraft = st === "draft";
  const vendorPortalLink = (po as { vendorPortalLink?: string | null }).vendorPortalLink;

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

  function openReceiveModal() {
    const init: Record<string, { receivedQty: string; lots: { batchNumber: string; expiryDate: string; qty: string }[] }> = {};
    for (const r of notReceivedRows) {
      const out = lineOutstanding(r);
      const track = rowTracksLots(r);
      init[r.id] = {
        receivedQty: String(out),
        lots: track ? [{ batchNumber: "", expiryDate: "", qty: String(out) }] : [],
      };
    }
    setReceiveRows(init);
    setReceiveLocationId(po.locationId ? String(po.locationId) : "");
    setReceiveOpen(true);
  }

  function addLot(rowId: string) {
    setReceiveRows((prev) => {
      const cur = prev[rowId] || { receivedQty: "0", lots: [] };
      return {
        ...prev,
        [rowId]: { ...cur, lots: [...cur.lots, { batchNumber: "", expiryDate: "", qty: "" }] },
      };
    });
  }

  function removeLot(rowId: string, idx: number) {
    setReceiveRows((prev) => {
      const cur = prev[rowId] || { receivedQty: "0", lots: [] };
      const nextLots = cur.lots.filter((_, i) => i !== idx);
      return { ...prev, [rowId]: { ...cur, lots: nextLots } };
    });
  }

  function updateLot(rowId: string, idx: number, key: "batchNumber" | "expiryDate" | "qty", value: string) {
    setReceiveRows((prev) => {
      const cur = prev[rowId] || { receivedQty: "0", lots: [] };
      const lots = [...cur.lots];
      lots[idx] = { ...lots[idx], [key]: value };
      return { ...prev, [rowId]: { ...cur, lots } };
    });
  }

  function canSubmitReceive(): boolean {
    if (!receiveLocationId && !po.locationId) return false;
    for (const r of notReceivedRows) {
      const state = receiveRows[r.id];
      const q = Number(state?.receivedQty ?? 0);
      if (q <= 0) continue;
      const track = rowTracksLots(r);
      if (!track) continue;
      const lots = state?.lots || [];
      if (!lots.length) return false;
      const sum = lots.reduce((s, l) => s + Number(l.qty || 0), 0);
      if (Math.abs(sum - q) > 1e-9) return false;
      if (lots.some((l) => !String(l.batchNumber || "").trim() || !String(l.expiryDate || "").trim() || Number(l.qty || 0) <= 0)) return false;
    }
    return true;
  }

  return (
    <div className="space-y-0">
      {/* Katana-style PO detail header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Purchase order</p>
              <h1 className="text-lg font-bold text-gray-900">
                {po.poNumber}
                {po.supplier?.name ? <span className="text-gray-700 font-medium"> {po.supplier.name}</span> : null}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {canConfirmFromDraft && (
                <button className="btn btn-ghost text-sm" disabled={updatePO.isPending} onClick={() => updatePO.mutate({ status: "confirmed" })}>Confirm</button>
              )}
              {canSendVendorInvite && (
                <button className="btn btn-ghost text-sm" disabled={sendToVendor.isPending} onClick={() => sendToVendor.mutate()}>
                  <Mail size={14} />{sendToVendor.isPending ? "Sending…" : "Email supplier"}
                </button>
              )}
              {canClosePO && (
                <button className="btn btn-ghost text-sm" disabled={updatePO.isPending}
                  onClick={() => { if (window.confirm("Close this purchase order?")) updatePO.mutate({ status: "done" }, { onSuccess: () => addToast("Purchase order closed", "success") }); }}>Close</button>
              )}
              {canReceive && (
                <button className="btn btn-primary text-sm" onClick={openReceiveModal}><PackageCheck size={14} />Receive</button>
              )}
              <StatusBadge status={po.status} />
              <span className="text-sm text-yellow-600 font-medium ml-1">{updatePO.isPending ? "Saving..." : "All changes saved"}</span>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" onClick={downloadPdf}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 14h12"/><path d="M10 18h4"/></svg>
              </button>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" onClick={openEditModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
              <Link href="/dashboard/buy" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </Link>
            </div>
          </div>

          {st === "vendor_rejected" && (po as { vendorResponseComment?: string | null }).vendorResponseComment ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 mb-4">
              <p className="font-semibold text-amber-900">Supplier message</p>
              <p className="mt-1 whitespace-pre-wrap">{(po as { vendorResponseComment?: string }).vendorResponseComment}</p>
            </div>
          ) : null}

          {/* Katana-style field grid with underline inputs */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            <div className="col-span-2">
              <label className="klabel">Supplier</label>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="klabel">Expected arrival</label>
                {canEditHeader ? (
                  <input className="kinput" type="date" disabled={updatePO.isPending} value={po.expectedAt ? po.expectedAt.slice(0, 10) : ""} onChange={(e) => updatePO.mutate({ expectedAt: e.target.value || null })} />
                ) : (
                  <p className="text-sm border-b border-gray-300 pb-2">{po.expectedAt ? po.expectedAt.slice(0, 10) : "—"}</p>
                )}
              </div>
              <div>
                <label className="klabel">Created date</label>
                <p className="text-sm border-b border-gray-300 pb-2">{po.createdAt ? new Date(po.createdAt).toISOString().slice(0, 10) : "—"}</p>
              </div>
            </div>
            <div>
              <label className="klabel">Order #</label>
              <p className="text-sm font-medium border-b border-gray-300 pb-2">{po.poNumber || "—"}</p>
            </div>
            <div>
              <label className="klabel">Order currency</label>
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
              <label className="klabel">Ship to</label>
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
      </div>

      <div className="px-6 py-4 space-y-4">

      <div className="card overflow-visible">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Items not received</h2>
        </div>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit cost</th>
                <th>Line total</th>
                <th>Received</th>
                <th>Lot</th>
                <th>Expiry</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {(notReceivedRows.length ? notReceivedRows : []).map((r: any, i: number) => (
                <tr key={r.id}>
                  {(() => {
                    const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
                    const m = r.material || (r.materialId ? materialById.get(r.materialId) : undefined);
                    const itemName =
                      m?.name ||
                      v?.product?.name ||
                      r.description ||
                      r.variantId ||
                      r.materialId ||
                      "—";
                    const skuPrefix = v?.sku ? `[${v.sku}] ` : m?.sku ? `[${m.sku}] ` : "";
                    const variantSuffix = v?.name && v?.product ? ` / ${v.name}` : "";
                    const recvLines = receiptLinesForRow(r);
                    return (
                      <>
                  <td className="text-gray-400">{i + 1}</td>
                  <td>
                    <span className="font-medium text-gray-900">
                          {skuPrefix}
                          {itemName}
                          {variantSuffix}
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
                  <td className="align-top text-xs text-gray-800 min-w-[88px]">
                    {recvLines.length ? (
                      <div className="space-y-1">
                        {recvLines.map((l) => (
                          <div key={l.id} className="tabular-nums">
                            {l.lotNumber || <span className="text-gray-400">—</span>}
                            {Number(l.qty) > 0 && <span className="text-gray-500 font-normal"> ({Number(l.qty)})</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="align-top text-xs text-gray-800 whitespace-nowrap min-w-[96px]">
                    {recvLines.length ? (
                      <div className="space-y-1">
                        {recvLines.map((l) => (
                          <div key={l.id}>{l.expiryDate || <span className="text-gray-400">—</span>}</div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
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
                      </>
                    );
                  })()}
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
                  <td />
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
              {!notReceivedRows.length && !canEditLines && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8">
                    No outstanding line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {receivedRows.length > 0 && (
          <>
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-800">Items received</h2>
            </div>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit cost</th>
                    <th>Line total</th>
                    <th>Received</th>
                    <th>Lot</th>
                    <th>Expiry</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {receivedRows.map((r: any, i: number) => (
                    <tr key={r.id}>
                      {(() => {
                        const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
                        const m = r.material || (r.materialId ? materialById.get(r.materialId) : undefined);
                        const itemName =
                          m?.name ||
                          v?.product?.name ||
                          r.description ||
                          r.variantId ||
                          r.materialId ||
                          "—";
                        const skuPrefix = v?.sku ? `[${v.sku}] ` : m?.sku ? `[${m.sku}] ` : "";
                        const variantSuffix = v?.name && v?.product ? ` / ${v.name}` : "";
                        const recvLines = receiptLinesForRow(r);
                        return (
                          <>
                            <td className="text-gray-400">{i + 1}</td>
                            <td>
                              <span className="font-medium text-gray-900">
                                {skuPrefix}
                                {itemName}
                                {variantSuffix}
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
                            <td className="align-top text-xs text-gray-800 min-w-[88px]">
                              {recvLines.length ? (
                                <div className="space-y-1">
                                  {recvLines.map((l) => (
                                    <div key={l.id} className="tabular-nums">
                                      {l.lotNumber || <span className="text-gray-400">—</span>}
                                      {Number(l.qty) > 0 && <span className="text-gray-500 font-normal"> ({Number(l.qty)})</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="align-top text-xs text-gray-800 whitespace-nowrap min-w-[96px]">
                              {recvLines.length ? (
                                <div className="space-y-1">
                                  {recvLines.map((l) => (
                                    <div key={l.id}>{l.expiryDate || <span className="text-gray-400">—</span>}</div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td>
                              {canEditLines && (
                                <button
                                  className="icon-btn text-red-400 hover:text-red-600"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Remove this row?")) deleteRow.mutate(r.id);
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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

      </div>{/* close px-6 py-4 content wrapper */}

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive Stock">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
          <p className="text-xs text-gray-500">Enter receive quantities per line. For lot-tracked items, lot number and expiry are required and can be split into multiple lots.</p>

          <div className="border border-gray-200 rounded">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="w-28">Outstanding</th>
                  <th className="w-28">Receive now</th>
                </tr>
              </thead>
              <tbody>
                {notReceivedRows.map((r: any) => {
                  const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
                  const m = r.material || (r.materialId ? materialById.get(r.materialId) : undefined);
                  const itemName = m?.name || v?.product?.name || r.description || "—";
                  const variantSuffix = v?.name && v?.product ? ` / ${v.name}` : "";
                  const outstanding = lineOutstanding(r);
                  const track = Boolean(v?.product?.trackLotsAndExpiry);
                  const state = receiveRows[r.id] || { receivedQty: String(outstanding), lots: [] };
                  return (
                    <tr key={`recv-${r.id}`}>
                      <td className="align-top">
                        <div className="font-medium">{itemName}{variantSuffix}</div>
                        {track && (
                          <div className="mt-2 space-y-2">
                            {(state.lots || []).map((lot, idx) => (
                              <div key={`${r.id}-lot-${idx}`} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-4">
                                  <label className="text-[11px] text-gray-500">Lot #</label>
                                  <input
                                    className="input py-1.5"
                                    value={lot.batchNumber}
                                    onChange={(e) => updateLot(r.id, idx, "batchNumber", e.target.value)}
                                  />
                                </div>
                                <div className="col-span-4">
                                  <label className="text-[11px] text-gray-500">Expiry</label>
                                  <input
                                    className="input py-1.5"
                                    type="date"
                                    value={lot.expiryDate}
                                    onChange={(e) => updateLot(r.id, idx, "expiryDate", e.target.value)}
                                  />
                                </div>
                                <div className="col-span-3">
                                  <label className="text-[11px] text-gray-500">Qty</label>
                                  <input
                                    className="input py-1.5"
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={lot.qty}
                                    onChange={(e) => updateLot(r.id, idx, "qty", e.target.value)}
                                  />
                                </div>
                                <div className="col-span-1">
                                  <button type="button" className="icon-btn text-red-500" onClick={() => removeLot(r.id, idx)}>×</button>
                                </div>
                              </div>
                            ))}
                            <button type="button" className="btn btn-ghost text-xs" onClick={() => addLot(r.id)}>
                              + Add lot
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="tabular-nums align-top">{outstanding}</td>
                      <td className="align-top">
                        <input
                          className="input py-1.5"
                          type="number"
                          min={0}
                          step="any"
                          value={state.receivedQty}
                          onChange={(e) => {
                            const vq = e.target.value;
                            setReceiveRows((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || { lots: [] }), receivedQty: vq } }));
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setReceiveOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={receive.isPending || !canSubmitReceive()} onClick={() => receive.mutate()}>
            {receive.isPending ? "Receiving…" : "Confirm receive"}
          </button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit purchase order">
        <div className="space-y-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status || po.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
              {PO_STATUS_EDIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
