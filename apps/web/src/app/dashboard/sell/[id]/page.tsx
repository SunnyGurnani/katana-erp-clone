"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

function orderIdFromParams(id: string | string[] | undefined): string {
  if (id == null) return "";
  return Array.isArray(id) ? (id[0] ?? "") : id;
}

export default function SODetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const orderId = orderIdFromParams(params.id);
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
  const [shipFromOneLocation, setShipFromOneLocation] = useState(false);
  const [fulfillRowsQty, setFulfillRowsQty] = useState<Record<string, string>>({});
  const [fulfillCarrier, setFulfillCarrier] = useState("");
  const [fulfillTracking, setFulfillTracking] = useState("");
  const [fulfillShipMethod, setFulfillShipMethod] = useState("");
  const [rowLineLocationId, setRowLineLocationId] = useState("");
  const [editForm, setEditForm] = useState({ status: "", dueAt: "", notes: "", customerId: "", currency: "USD", locationId: "" });
  const [fulfillError, setFulfillError] = useState("");
  const [lineFulfillOpen, setLineFulfillOpen] = useState(false);
  const [lineFulfillRowId, setLineFulfillRowId] = useState("");
  const [lineFulfillQty, setLineFulfillQty] = useState("");
  const [lineFulfillBatchId, setLineFulfillBatchId] = useState("");
  const [lineFulfillError, setLineFulfillError] = useState("");
  const searchParams = useSearchParams();
  const listStatus = searchParams.get("listStatus") || "";
  const sellListHref = listStatus
    ? `/dashboard/sell?status=${encodeURIComponent(listStatus)}`
    : "/dashboard/sell";

  const {
    data: so,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["so", orderId],
    enabled: !!orderId,
    queryFn: () => api.get(`/sales-orders/${orderId}`).then((r) => r.data),
  });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });
  const { data: lineBatchOptions, isFetching: lineBatchesLoading } = useQuery({
    queryKey: ["line-batches", orderId, lineFulfillRowId],
    enabled: Boolean(orderId && lineFulfillRowId && lineFulfillOpen),
    queryFn: () => api.get(`/sales-orders/${orderId}/rows/${lineFulfillRowId}/available-batches`).then((r) => r.data),
  });

  const variantOpts = useMemo(() => productVariantOptions(products), [products]);
  const locOpts = useMemo(() => locationOptions(locations), [locations]);
  const custOpts = useMemo(() => customerOptions(customers), [customers]);
  const variantById = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => (p.variants || []).forEach((v: any) => map.set(v.id, { ...v, product: p })));
    return map;
  }, [products]);

  const addRow = useMutation({
    mutationFn: () => api.post(`/sales-orders/${orderId}/rows`, {
      variantId: variantId || undefined,
      qty: Number(qty),
      salePrice: salePrice === "" ? undefined : Number(salePrice),
      locationId: rowLineLocationId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["so", orderId] });
      addToast("Row added", "success");
      setRowOpen(false);
      setVariantId("");
      setQty("");
      setSalePrice("");
      setRowLineLocationId("");
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.issues?.[0]?.message ||
        "Error adding row";
      addToast(typeof msg === "string" ? msg : "Error adding row", "error");
    },
  });

  const fulfill = useMutation({
    mutationFn: (payload: {
      locationId?: string;
      rows: { rowId: string; qty: number; batchId?: string; locationId?: string }[];
      carrier?: string;
      trackingNumber?: string;
      shipMethod?: string;
    }) => api.post(`/sales-orders/${orderId}/fulfill`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["so", orderId] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["line-batches", orderId] });
      addToast("Shipment recorded", "success");
      setFulfillOpen(false);
      setFulfillError("");
      setFulfillCarrier("");
      setFulfillTracking("");
      setFulfillShipMethod("");
      setLineFulfillOpen(false);
      setLineFulfillRowId("");
      setLineFulfillQty("");
      setLineFulfillBatchId("");
      setLineFulfillError("");
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
    mutationFn: () => api.post(`/sales-orders/${orderId}/revert-fulfillment`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["so", orderId] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      addToast("Fulfillment reverted; stock restored.", "success");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Could not revert fulfillment";
      addToast(typeof msg === "string" ? msg : "Could not revert fulfillment", "error");
    },
  });

  const updateSO = useMutation({
    mutationFn: (d: any) => api.patch(`/sales-orders/${orderId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", orderId] }); addToast("Updated", "success"); setEditOpen(false); },
    onError: () => addToast("Error updating SO", "error"),
  });

  const deleteSO = useMutation({
    mutationFn: () => api.delete(`/sales-orders/${orderId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      addToast("Deleted", "success");
      router.push(sellListHref);
    },
    onError: () => addToast("Error deleting SO", "error"),
  });

  const duplicateSO = useMutation({
    mutationFn: () => api.post(`/sales-orders/${orderId}/duplicate`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      addToast("Duplicated", "success");
      const nid = res.data.id || res.data.data?.id || "";
      router.push(nid ? `/dashboard/sell/${nid}?listStatus=draft` : "/dashboard/sell?status=draft");
    },
    onError: () => addToast("Error duplicating SO", "error"),
  });

  const deleteRow = useMutation({
    mutationFn: (rowId: string) => api.delete(`/sales-order-rows/${rowId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", orderId] }); addToast("Row removed", "success"); },
    onError: () => addToast("Error removing row", "error"),
  });

  function downloadPdf() {
    api.get(`/pdf/sales-order/${orderId}`, { responseType: "blob" }).then(res => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `SO-${so?.soNumber || orderId}.pdf`; a.click(); URL.revokeObjectURL(url);
    }).catch(() => addToast("Error downloading PDF", "error"));
  }

  if (!orderId) {
    return (
      <div className="p-6 text-gray-600">
        <Link href={sellListHref} className="text-brand-600 hover:underline">← Back to sales orders</Link>
        <p className="mt-2">Missing order id in the URL.</p>
      </div>
    );
  }
  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={6} /></tbody></table></div>;
  if (isError) {
    const ax = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
    const status = ax?.response?.status;
    const msg =
      (typeof ax?.response?.data?.error === "string" && ax.response.data.error) ||
      ax?.message ||
      "Could not load this order.";
    return (
      <div className="p-6 space-y-2">
        <Link href={sellListHref} className="text-brand-600 hover:underline">← Back to sales orders</Link>
        <div className={`rounded-md border px-3 py-2 text-sm ${status === 404 ? "border-gray-200 bg-gray-50 text-gray-700" : "border-red-200 bg-red-50 text-red-800"}`}>
          {status === 404 ? "Sales order not found (it may have been deleted)." : msg}
        </div>
      </div>
    );
  }
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
      locationId: so.locationId || "",
    });
    setEditOpen(true);
  }

  function lineLocationLabel(r: any): string {
    if (r.location?.name) return r.location.name;
    if (so.location?.name) return `${so.location.name} (order default)`;
    return "—";
  }

  function stockLineSummary(r: any): string {
    const s = r.stockAtLineLocation;
    if (!s) return "—";
    if (s.scope === "all_locations") {
      return `All sites: ${Number(s.onHand)} on hand · ${Number(s.available)} avail`;
    }
    const bits = [`${Number(s.onHand)} on hand`, `${Number(s.available)} avail`];
    if (Number(s.allocated) > 0) bits.push(`${Number(s.allocated)} reserved`);
    return bits.join(" · ");
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

  function openFulfillModal() {
    setFulfillError("");
    const rows = (so.rows || []).filter((r: any) => {
      const rem = Number(r.qty) - Number(r.fulfilledQty || 0);
      return rem > 0 && r.variantId;
    });
    const initQty: Record<string, string> = {};
    rows.forEach((r: any) => {
      initQty[r.id] = String(Number(r.qty) - Number(r.fulfilledQty || 0));
    });
    setFulfillRowsQty(initQty);
    const eff = rows.map((r: any) => r.locationId || so.locationId || "");
    const uniq = [...new Set(eff.filter(Boolean))];
    const missingLoc = rows.some((r: any) => !(r.locationId || so.locationId));
    setShipFromOneLocation(!missingLoc && uniq.length === 1);
    setFulfillLocationId(!missingLoc && uniq.length === 1 ? String(uniq[0]) : "");
    setFulfillOpen(true);
  }

  function openLineFulfillModal(row: any) {
    const rem = Number(row.qty) - Number(row.fulfilledQty || 0);
    if (rem <= 0 || !row.variantId) return;
    setLineFulfillError("");
    setLineFulfillRowId(row.id);
    setLineFulfillQty(String(rem));
    setLineFulfillBatchId("");
    setLineFulfillOpen(true);
  }

  function submitLineFulfill() {
    const row = (so.rows || []).find((r: any) => r.id === lineFulfillRowId);
    if (!row?.variantId) {
      setLineFulfillError("Invalid line.");
      return;
    }
    const rem = Number(row.qty) - Number(row.fulfilledQty || 0);
    const q = Number(lineFulfillQty);
    if (!Number.isFinite(q) || q <= 0) {
      setLineFulfillError("Enter a valid quantity.");
      addToast("Enter quantity to ship.", "error");
      return;
    }
    if (q > rem) {
      setLineFulfillError(`Cannot exceed ${rem} remaining on this line.`);
      return;
    }
    const loc = row.locationId || so.locationId;
    if (!loc) {
      setLineFulfillError("Set a ship-from location on the line or order.");
      addToast("Location required.", "error");
      return;
    }
    const track = Boolean(row.trackLotsAndExpiry);
    if (track) {
      if (!lineFulfillBatchId) {
        setLineFulfillError("Select a lot with available quantity.");
        addToast("Select a lot.", "error");
        return;
      }
      const batches = lineBatchOptions?.batches ?? [];
      if (!batches.length) {
        setLineFulfillError("No lots with stock at this location. Receive inventory to a batch first.");
        addToast("No lots available.", "error");
        return;
      }
    }
    setLineFulfillError("");
    fulfill.mutate({
      rows: [
        {
          rowId: row.id,
          qty: q,
          locationId: loc,
          ...(track && lineFulfillBatchId ? { batchId: lineFulfillBatchId } : {}),
        },
      ],
    });
  }

  function submitFulfill() {
    const rowsPayload: { rowId: string; qty: number }[] = [];
    for (const r of so.rows || []) {
      const rem = Number(r.qty) - Number(r.fulfilledQty || 0);
      if (rem <= 0 || !r.variantId) continue;
      const raw = fulfillRowsQty[r.id];
      const q = raw === undefined || raw === "" ? rem : Number(raw);
      if (!Number.isFinite(q) || q <= 0) continue;
      if (q > rem) {
        const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
        const lab = v?.sku || v?.product?.name || r.description || "line";
        setFulfillError(`Quantity for ${lab} cannot exceed ${rem} (remaining).`);
        addToast(`Check quantities (${lab}).`, "error");
        return;
      }
      rowsPayload.push({ rowId: r.id, qty: q });
    }
    if (!rowsPayload.length) {
      setFulfillError("Enter at least one positive quantity to ship.");
      addToast("Enter ship quantities.", "error");
      return;
    }
    if (shipFromOneLocation) {
      const loc = fulfillLocationId || so.locationId;
      if (!loc) {
        setFulfillError("Select a ship-from location (or set an order default).");
        addToast("Select ship-from location.", "error");
        return;
      }
    }
    setFulfillError("");
    const payload: {
      locationId?: string;
      rows: { rowId: string; qty: number; batchId?: string; locationId?: string }[];
      carrier?: string;
      trackingNumber?: string;
      shipMethod?: string;
    } = { rows: rowsPayload };
    if (shipFromOneLocation) {
      payload.locationId = fulfillLocationId || so.locationId || undefined;
    }
    if (fulfillCarrier.trim()) payload.carrier = fulfillCarrier.trim();
    if (fulfillTracking.trim()) payload.trackingNumber = fulfillTracking.trim();
    if (fulfillShipMethod.trim()) payload.shipMethod = fulfillShipMethod.trim();
    fulfill.mutate(payload);
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={sellListHref} className="icon-btn"><ArrowLeft size={16} /></Link>
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
        {canFulfill && (
          <button type="button" className="btn btn-primary" onClick={openFulfillModal}>
            <Truck size={15} />Fulfill
          </button>
        )}
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Due</p><p className="font-medium">{so.dueAt ? formatLocalDateDisplay(so.dueAt) : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Default ship location</p><p className="font-medium">{so.location?.name || "—"}</p></div>
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
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Location</th>
              <th>In stock</th>
              <th>Qty</th>
              <th>Sale Price</th>
              <th>Fulfilled</th>
              <th>Line Total</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(so.rows || []).map((r: any) => (
              <tr key={r.id}>
                {(() => {
                  const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
                  const rem = Number(r.qty) - Number(r.fulfilledQty || 0);
                  return (
                    <>
                      <td className="font-mono text-sm">{v?.sku || "—"}</td>
                      <td>{v?.product?.name || r.description || r.variantId || "—"}</td>
                      <td className="text-sm text-gray-700 max-w-[160px]">{lineLocationLabel(r)}</td>
                      <td className="text-sm text-gray-600 whitespace-nowrap">{r.variantId ? stockLineSummary(r) : "—"}</td>
                      <td>{r.qty}</td>
                      <td>{Number(r.salePrice || 0).toFixed(2)} {so.currency || "USD"}</td>
                      <td>{r.fulfilledQty || 0}</td>
                      <td>{(Number(r.qty) * Number(r.salePrice || 0)).toFixed(2)} {so.currency || "USD"}</td>
                      <td className="text-right whitespace-nowrap">
                        {canFulfill && r.variantId && rem > 0 && (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs mr-1"
                            onClick={() => openLineFulfillModal(r)}
                          >
                            <Truck size={13} className="inline mr-0.5" />Ship line
                          </button>
                        )}
                        {["draft", "confirmed"].includes(so.status) && (
                          <button type="button" className="icon-btn text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); if (window.confirm("Remove this row?")) deleteRow.mutate(r.id); }}><X size={14} /></button>
                        )}
                      </td>
                    </>
                  );
                })()}
              </tr>
            ))}
            {!so.rows?.length && <tr><td colSpan={10} className="text-center text-gray-400 py-8">No line items yet</td></tr>}
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
                <th>Lot</th>
                <th>Expiry</th>
                <th>Carrier</th>
                <th>Tracking</th>
                <th>Method</th>
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
                      <td className="text-sm font-mono text-gray-700">{f.batch?.batchNumber || "—"}</td>
                      <td className="text-sm text-gray-600">{f.batch?.expiryDate ? formatLocalDateDisplay(f.batch.expiryDate) : "—"}</td>
                      <td className="text-sm text-gray-600">{f.carrier || "—"}</td>
                      <td className="text-sm font-mono text-gray-700">{f.trackingNumber || "—"}</td>
                      <td className="text-sm text-gray-600">{f.shipMethod || "—"}</td>
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
          <div>
            <label className="label">Ship-from location (optional)</label>
            <SearchableSelect
              value={rowLineLocationId}
              onChange={setRowLineLocationId}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel={so.locationId ? "— Use order default —" : "— Select —"}
              aria-label="Line ship-from location"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default warehouse for this line. When you fulfill, stock is deducted from this location unless you choose &quot;Ship all lines from one location&quot; in the fulfill dialog.
            </p>
          </div>
          <div><label className="label">Qty</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Sale Price</label><input className="input" type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setRowOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={addRow.isPending} onClick={submitAddRow}>{addRow.isPending ? "Adding..." : "Add"}</button>
        </div>
      </Modal>

      <Modal
        open={lineFulfillOpen}
        onClose={() => {
          setLineFulfillOpen(false);
          setLineFulfillRowId("");
          setLineFulfillError("");
        }}
        title="Ship this line"
      >
        {(() => {
          const lfRow = (so.rows || []).find((r: any) => r.id === lineFulfillRowId);
          const needLot = Boolean(lfRow?.trackLotsAndExpiry);
          const selectedLot = lineBatchOptions?.batches?.find((b: { batchId: string }) => b.batchId === lineFulfillBatchId);
          return (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {lfRow
                  ? (() => {
                      const v = lfRow.variant || (lfRow.variantId ? variantById.get(lfRow.variantId) : undefined);
                      return v?.product?.name || v?.sku || lfRow.description || "Line";
                    })()
                  : "—"}
              </p>
              <div>
                <label className="label">Quantity to ship</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  value={lineFulfillQty}
                  onChange={(e) => setLineFulfillQty(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Ship-from: {lfRow ? lineLocationLabel(lfRow) : "—"}</p>
              </div>
              {needLot && (
                <div className="space-y-2">
                  <label className="label">Lot / batch</label>
                  {lineBatchesLoading ? (
                    <p className="text-sm text-gray-500">Loading lots…</p>
                  ) : (
                    <select
                      className="input"
                      value={lineFulfillBatchId}
                      onChange={(e) => setLineFulfillBatchId(e.target.value)}
                      aria-label="Lot or batch"
                    >
                      <option value="">— Select lot —</option>
                      {(lineBatchOptions?.batches ?? []).map((b: { batchId: string; batchNumber: string; onHand: number; expiryDate?: string | null }) => (
                        <option key={b.batchId} value={b.batchId}>
                          {b.batchNumber} · {Number(b.onHand)} avail
                          {b.expiryDate ? ` · exp ${formatLocalDateDisplay(b.expiryDate)}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <div>
                    <label className="label">Expiry (from lot)</label>
                    <input
                      className="input bg-gray-50"
                      readOnly
                      value={selectedLot?.expiryDate ? formatLocalDateDisplay(selectedLot.expiryDate) : "—"}
                    />
                  </div>
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    This product is set to track lots and expiry — you must ship from a batch that has stock at the line&apos;s location.
                  </p>
                </div>
              )}
              {lineFulfillError && <p className="text-sm text-red-600">{lineFulfillError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setLineFulfillOpen(false);
                    setLineFulfillRowId("");
                    setLineFulfillError("");
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" disabled={fulfill.isPending} onClick={submitLineFulfill}>
                  {fulfill.isPending ? "Shipping…" : "Confirm"}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={fulfillOpen} onClose={() => { setFulfillOpen(false); setFulfillError(""); }} title="Ship order">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={shipFromOneLocation}
              onChange={(e) => {
                setShipFromOneLocation(e.target.checked);
                setFulfillError("");
              }}
            />
            <span>
              <span className="font-medium">Ship all lines from one location</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Off (default): each line ships from its line-level or order default location — required for multi-site orders.
              </span>
            </span>
          </label>
          {shipFromOneLocation && (
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
          )}
          <div>
            <p className="label mb-2">Quantities to ship</p>
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Ship from</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {(so.rows || []).map((r: any) => {
                  const rem = Number(r.qty) - Number(r.fulfilledQty || 0);
                  if (rem <= 0 || !r.variantId) return null;
                  const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
                  const lab = v?.sku || v?.product?.name || r.description || "—";
                  const from = lineLocationLabel(r);
                  return (
                    <tr key={r.id}>
                      <td className="max-w-[140px] truncate">{lab}</td>
                      <td className="text-gray-600 text-xs max-w-[120px]">{from}</td>
                      <td className="w-24">
                        <input
                          className="input py-1 text-sm"
                          type="number"
                          min={0}
                          step="any"
                          value={fulfillRowsQty[r.id] ?? String(rem)}
                          onChange={(e) => setFulfillRowsQty((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-1">Leave default to ship the full remaining quantity, or lower for a partial shipment.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Carrier</label>
              <input className="input" value={fulfillCarrier} onChange={(e) => setFulfillCarrier(e.target.value)} placeholder="e.g. UPS" />
            </div>
            <div>
              <label className="label">Tracking #</label>
              <input className="input font-mono text-sm" value={fulfillTracking} onChange={(e) => setFulfillTracking(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Shipping method</label>
              <input className="input" value={fulfillShipMethod} onChange={(e) => setFulfillShipMethod(e.target.value)} placeholder="e.g. Ground" />
            </div>
          </div>
          {fulfillError && <p className="text-sm text-red-600">{fulfillError}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={() => { setFulfillOpen(false); setFulfillError(""); }}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={fulfill.isPending} onClick={submitFulfill}>{fulfill.isPending ? "Shipping..." : "Confirm shipment"}</button>
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
            <label className="label">Default ship location</label>
            <SearchableSelect
              value={editForm.locationId}
              onChange={(v) => setEditForm((f) => ({ ...f, locationId: v }))}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel="— None —"
              aria-label="Order default location"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {statusEditOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "confirmed" ? "Confirmed (appears on Open list)" : s}
                </option>
              ))}
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
                locationId: editForm.locationId || null,
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
