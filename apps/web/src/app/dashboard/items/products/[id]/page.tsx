"use client";
import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { VariantConfigModal, type VariantOptionConfig } from "@/components/products/VariantConfigModal";
import { UnitOfMeasureField } from "@/components/shared/UnitOfMeasureField";
import { formatQty } from "@/lib/formatQty";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface BOM {
  id: string;
  name: string;
  qty: number;
  variantId?: string | null;
  notes?: string;
  rows: BOMRow[];
  operations: ProductOperation[];
}

interface BOMRow {
  id: string;
  materialId?: string;
  variantId?: string;
  qty: number;
  unitCost?: number;
  notes?: string;
  material?: { id: string; name: string; purchasePrice?: number | string; unitOfMeasure?: string };
}

function rowUnitCost(r: BOMRow, materialById: Map<string, any>): number {
  if (r.unitCost != null && Number(r.unitCost) > 0) return Number(r.unitCost);
  const fromRow = r.material?.purchasePrice;
  if (fromRow != null && Number(fromRow) > 0) return Number(fromRow);
  if (r.materialId) {
    const m = materialById.get(r.materialId);
    if (m?.purchasePrice != null && Number(m.purchasePrice) > 0) return Number(m.purchasePrice);
  }
  return 0;
}

function rowStockCost(r: BOMRow, materialById: Map<string, any>): number {
  return rowUnitCost(r, materialById) * Number(r.qty);
}

interface ProductOperation {
  id: string;
  name: string;
  rank: number;
  durationMinutes?: number;
  costPerHour?: number;
  notes?: string;
}

const bomRowBlank = { materialId: "", variantId: "", qty: "", unitCost: "", notes: "" };
const operationBlank = { name: "", rank: "", durationMinutes: "", costPerHour: "", notes: "" };

export default function ProductDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [productForm, setProductForm] = useState({
    name: "", sku: "", description: "", category: "", unitOfMeasure: "pcs",
    salesPrice: "", purchasePrice: "", 
    trackLots: false, trackExpiry: false
  });
  const [bomRowOpen, setBomRowOpen] = useState(false);
  const [bomRowForm, setBomRowForm] = useState({ id: "", materialId: "", qty: "", unitCost: "", notes: "" });
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationForm, setOperationForm] = useState({ ...operationBlank, id: "" });
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const variantBlank = { name: "", sku: "", salesPrice: "", purchasePrice: "" };
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantForm, setVariantForm] = useState({ ...variantBlank, id: "" });
  const [variantConfigOpen, setVariantConfigOpen] = useState(false);
  const [skuDrafts, setSkuDrafts] = useState<Record<string, string>>({});
  const [materialCreateOpen, setMaterialCreateOpen] = useState(false);
  const [materialCreateQuery, setMaterialCreateQuery] = useState("");
  const [newMaterialForm, setNewMaterialForm] = useState({
    name: "",
    unit: "kg",
    purchasePrice: "",
  });

  // Queries
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await api.get(`/products/${id}`);
      const data = res.data;
      setProductForm({
        name: data.name || "",
        sku: data.sku || "",
        description: data.description || "",
        category: data.category || "",
        unitOfMeasure: data.unitOfMeasure || "pcs",
        salesPrice: data.salesPrice || "",
        purchasePrice: data.purchasePrice || "",
        trackLots: !!data.trackLots,
        trackExpiry: !!data.trackExpiry,
      });
      return data;
    },
  });

  const { data: boms = [] } = useQuery({
    queryKey: ["boms", id],
    queryFn: () => api.get("/recipes", { params: { productId: id } }).then(r => r.data.data || []),
    enabled: !!id,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: () => api.get("/materials").then(r => r.data.data || []),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then(r => r.data.data || []),
  });

  const materialById = useMemo(() => {
    const m = new Map<string, any>();
    (materials as any[]).forEach((x) => m.set(x.id, x));
    return m;
  }, [materials]);

  const variantById = useMemo(() => {
    const m = new Map<string, any>();
    (allProducts as any[]).forEach((p) =>
      (p.variants || []).forEach((v: any) => m.set(v.id, { ...v, product: p }))
    );
    return m;
  }, [allProducts]);

  const variantOptionsList = useMemo(() => {
    const out: any[] = [];
    (allProducts as any[]).forEach((p) =>
      (p.variants || []).forEach((v: any) => out.push({ ...v, product: p }))
    );
    return out;
  }, [allProducts]);

  // Mutations
  const updateProduct = useMutation({
    mutationFn: (data: typeof productForm) =>
      api.put(`/products/${id}`, {
        name: data.name,
        sku: data.sku || undefined,
        description: data.description || null,
        category: data.category || null,
        unitOfMeasure: (data.unitOfMeasure || "pcs").trim() || "pcs",
        salesPrice: data.salesPrice !== "" ? Number(data.salesPrice) : undefined,
        purchasePrice: data.purchasePrice !== "" ? Number(data.purchasePrice) : undefined,
        trackLots: data.trackLots,
        trackExpiry: data.trackExpiry,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      addToast("Product updated", "success");
    },
  });

  const saveBomRow = useMutation({
    mutationFn: (data: any) => {
      const material = data.materialId ? materialById.get(data.materialId) : null;
      const unitCost =
        data.unitCost !== "" && data.unitCost != null
          ? Number(data.unitCost)
          : material?.purchasePrice != null
            ? Number(material.purchasePrice)
            : undefined;
      const payload = {
        ...data,
        bomId: activeBom?.id,
        unitCost,
        qty: Number(data.qty),
      };
      return data.id ? api.patch(`/bom-rows/${data.id}`, payload) : api.post("/bom-rows", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms", id] });
      addToast("BOM row saved", "success");
      setBomRowOpen(false);
      setBomRowForm({ id: "", materialId: "", qty: "", unitCost: "", notes: "" });
    },
  });

  const deleteBomRow = useMutation({
    mutationFn: (rowId: string) => api.delete(`/bom-rows/${rowId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms", id] });
      addToast("BOM row deleted", "success");
    },
  });

  const saveOperation = useMutation({
    mutationFn: (data: any) => data.id ? 
      api.patch(`/product-operations/${data.id}`, data) : 
      api.post("/product-operations", { ...data, bomId: activeBom?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms", id] });
      addToast("Operation saved", "success");
      setOperationOpen(false);
      setOperationForm({ ...operationBlank, id: "" });
    },
  });

  const deleteOperation = useMutation({
    mutationFn: (opId: string) => api.delete(`/product-operations/${opId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms", id] });
      addToast("Operation deleted", "success");
    },
  });

  const saveVariant = useMutation({
    mutationFn: (data: any) => data.id ? 
      api.patch(`/variants/${data.id}`, data) : 
      api.post("/variants", { ...data, productId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      addToast("Variant saved", "success");
      setVariantOpen(false);
      setVariantForm({ ...variantBlank, id: "" });
    },
  });

  const deleteVariant = useMutation({
    mutationFn: (variantId: string) => api.delete(`/variants/${variantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      addToast("Variant deleted", "success");
    },
  });

  const createBom = useMutation({
    mutationFn: (variantId: string | null) => 
      api.post("/recipes", { productId: id, variantId, name: "Recipe", qty: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms", id] });
      addToast("Recipe created", "success");
    },
  });

  const setHasVariants = useMutation({
    mutationFn: (hasVariants: boolean) =>
      api.patch(`/products/${id}`, { hasVariants }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product", id] }),
  });

  const generateVariants = useMutation({
    mutationFn: (options: VariantOptionConfig[]) =>
      api.post(`/products/${id}/variants/generate`, { options, replaceExisting: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      addToast("Variants generated", "success");
      setVariantConfigOpen(false);
    },
    onError: () => addToast("Failed to generate variants", "error"),
  });

  const patchVariantSku = useMutation({
    mutationFn: ({ variantId, sku }: { variantId: string; sku: string }) =>
      api.patch(`/variants/${variantId}`, { sku: sku || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product", id] }),
  });

  const createMaterial = useMutation({
    mutationFn: (data: { name: string; unit: string; purchasePrice: string }) =>
      api.post("/materials", {
        name: data.name,
        unitOfMeasure: data.unit,
        purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      const created = res.data;
      setBomRowForm((f) => ({
        ...f,
        materialId: created.id,
        unitCost: created.purchasePrice?.toString() || f.unitCost,
      }));
      setMaterialCreateOpen(false);
      addToast("Material created", "success");
    },
    onError: () => addToast("Failed to create material", "error"),
  });

  const hasVariantsEnabled =
    product?.hasVariants || (product?.variants?.length ?? 0) > 0;

  const materialOptions = useMemo(
    () => (materials as any[]).map((m) => ({ value: m.id, label: m.name })),
    [materials],
  );

  const commitSku = useCallback(
    (variantId: string, sku: string) => {
      patchVariantSku.mutate({ variantId, sku });
      setSkuDrafts((d) => {
        const next = { ...d };
        delete next[variantId];
        return next;
      });
    },
    [patchVariantSku],
  );

  const handleVariantsCheckbox = (checked: boolean) => {
    if (checked) {
      setHasVariants.mutate(true, {
        onSuccess: () => setVariantConfigOpen(true),
      });
    } else {
      if ((product?.variants?.length ?? 0) > 0) {
        if (!confirm("Disable variants? Existing variant rows will remain.")) return;
      }
      setHasVariants.mutate(false);
    }
  };

  // Get active Variant and BOM
  const activeVariantId = selectedVariantId || (product?.variants?.[0]?.id) || null;
  const activeBom = boms.find((b: BOM) => activeVariantId ? b.variantId === activeVariantId : !b.variantId) || 
                    boms.find((b: BOM) => !b.variantId) ||
                    (boms.length > 0 ? boms[0] : undefined);

  if (isLoading) return (
    <div className="p-8 space-y-6 page-transition">
      <div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
      <div className="h-64 w-full bg-gray-100 rounded animate-pulse mt-8" />
    </div>
  );
  if (!product) return <div className="p-4">Product not found</div>;

  const tabs = [
    { id: "general", label: "General info" },
    { id: "bom", label: "Product recipe / BOM" },
    { id: "operations", label: "Production operations" },
    { id: "supply", label: "Supply details" },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header — Katana style */}
      <div className="border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 font-medium">Product</p>
            <h1 className="text-lg font-bold text-gray-900">{product.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-yellow-600 font-medium">
              {updateProduct.isPending ? "Saving..." : "All changes saved"}
            </span>
            <Link href="/dashboard/items" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs — Katana dark pill style */}
      <div className="border-b border-gray-200 px-6 py-2 bg-gray-50/80">
        <div className="flex gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? "ktab-active" : "ktab-inactive"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "general" && (
          <div className="px-6 py-5">
            {/* Two-column layout like Katana */}
            <div className="grid grid-cols-2 gap-x-16">
              {/* Left Column — Product fields */}
              <div className="space-y-5">
                <div>
                  <label className="klabel">Product name</label>
                  <input 
                    className="kinput font-medium" 
                    placeholder="Type product name"
                    value={productForm.name} 
                    onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} 
                  />
                </div>
                <div>
                  <label className="klabel">Category</label>
                  <input 
                    className="kinput" 
                    placeholder="Select or create category"
                    value={productForm.category} 
                    onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} 
                  />
                </div>
                <div className="w-1/2">
                  <UnitOfMeasureField
                    label="Unit of measure"
                    value={productForm.unitOfMeasure}
                    onChange={(unitOfMeasure) => setProductForm((f) => ({ ...f, unitOfMeasure }))}
                  />
                </div>
                <div>
                  <label className="klabel">SKU / Internal reference</label>
                  <input 
                    className="kinput" 
                    value={productForm.sku} 
                    onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} 
                  />
                </div>
              </div>

              {/* Right Column — Usability & Tracking */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Usability</h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600" defaultChecked /> Sell
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600" defaultChecked /> Buy
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600" defaultChecked /> Make
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600" /> Kit/bundle
                    </label>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Product tracking</h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="tracking" className="w-4 h-4 text-brand-600" defaultChecked={!productForm.trackLots && !productForm.trackExpiry} onChange={() => setProductForm(f => ({ ...f, trackLots: false, trackExpiry: false }))} /> No tracking
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="tracking" className="w-4 h-4 text-brand-600" defaultChecked={productForm.trackLots} onChange={() => setProductForm(f => ({ ...f, trackLots: true, trackExpiry: false }))} /> Batch / lot numbers
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="tracking" className="w-4 h-4 text-brand-600" defaultChecked={productForm.trackExpiry} onChange={() => setProductForm(f => ({ ...f, trackLots: false, trackExpiry: true }))} /> Serial numbers
                    </label>
                  </div>
                </div>

                {/* Default prices */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="klabel">Default sales price</label>
                    <input 
                      className="kinput" 
                      type="number" step="0.01"
                      placeholder="Type sales price"
                      value={productForm.salesPrice} 
                      onChange={e => setProductForm(f => ({ ...f, salesPrice: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <label className="klabel">Default purchase price</label>
                    <input 
                      className="kinput" 
                      type="number" step="0.01"
                      placeholder="Type purchase price"
                      value={productForm.purchasePrice} 
                      onChange={e => setProductForm(f => ({ ...f, purchasePrice: e.target.value }))} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Variant toggle — Katana style */}
            <div className="mt-8 border-t border-gray-200 pt-5">
              <p className="text-sm text-blue-700 font-medium mb-2">Does this product come in different colors, sizes or similar?</p>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-brand-600"
                  checked={hasVariantsEnabled}
                  onChange={(e) => handleVariantsCheckbox(e.target.checked)}
                />
                Yes, this product has multiple variants
              </label>
              {hasVariantsEnabled && (
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 mt-2 font-medium block"
                  onClick={() => setVariantConfigOpen(true)}
                >
                  Configure variant options…
                </button>
              )}
            </div>

            {/* Inline Variant Table — Katana style (on General Info tab) */}
            {(product.variants?.length > 0) && (
              <div className="mt-5">
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Variant code / SKU</th>
                        <th>Default sales price</th>
                        <th>Ingredients cost</th>
                        <th>Operations cost</th>
                        <th>In stock</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.map((v: any) => (
                        <tr key={v.id}>
                          <td>
                            <input
                              className="kinput text-sm py-1 max-w-[140px]"
                              value={skuDrafts[v.id] ?? v.sku ?? ""}
                              placeholder={v.name}
                              onChange={(e) =>
                                setSkuDrafts((d) => ({ ...d, [v.id]: e.target.value }))
                              }
                              onBlur={() => {
                                const draft = skuDrafts[v.id];
                                if (draft !== undefined && draft !== (v.sku || "")) {
                                  commitSku(v.id, draft);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                            <span className="text-xs text-gray-400 block mt-0.5">{v.name}</span>
                          </td>
                          <td>{v.salesPrice ? `$${Number(v.salesPrice).toFixed(2)}` : "—"}</td>
                          <td className="text-gray-400">0 <span className="text-xs">CAD</span></td>
                          <td className="text-gray-400">0 <span className="text-xs">CAD</span></td>
                          <td>{v.inStock || "0 pcs"}</td>
                          <td>
                            <ActionMenu actions={[
                              { label: "Edit", icon: <Pencil size={13} />, onClick: () => {
                                setVariantForm({ id: v.id, name: v.name, sku: v.sku || "", salesPrice: v.salesPrice?.toString() || "", purchasePrice: v.purchasePrice?.toString() || "" });
                                setVariantOpen(true);
                              }},
                              { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => {
                                if (confirm("Delete this variant?")) deleteVariant.mutate(v.id);
                              }},
                            ]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button 
                  className="text-sm text-blue-600 hover:text-blue-800 mt-2 font-medium"
                  onClick={() => { setVariantForm({ ...variantBlank, id: "" }); setVariantOpen(true); }}
                >
                  + Add variant
                </button>
              </div>
            )}

            {hasVariantsEnabled && (product.variants?.length === 0 || !product.variants) && (
              <div className="mt-3 flex gap-4">
                <button 
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setVariantConfigOpen(true)}
                >
                  Configure & generate variants
                </button>
                <button 
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => { setVariantForm({ ...variantBlank, id: "" }); setVariantOpen(true); }}
                >
                  + Add variant manually
                </button>
              </div>
            )}

            {/* Additional info — Katana style */}
            <div className="mt-8 border-t border-gray-200 pt-5">
              <label className="klabel">Additional info</label>
              <div className="border border-gray-200 rounded-md mt-1">
                <div className="flex gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <button className="p-1 text-gray-500 hover:text-gray-700 text-sm font-bold">B</button>
                  <button className="p-1 text-gray-500 hover:text-gray-700 text-sm italic">I</button>
                  <button className="p-1 text-gray-500 hover:text-gray-700 text-sm underline">U</button>
                </div>
                <textarea 
                  className="w-full px-3 py-2 text-sm border-0 focus:outline-none resize-none min-h-[60px]"
                  placeholder="Type comment here"
                  value={productForm.description}
                  onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Save button */}
            <div className="mt-6 flex justify-end">
              <button 
                className="btn btn-primary px-6"
                onClick={() => updateProduct.mutate(productForm)}
                disabled={updateProduct.isPending}
              >
                {updateProduct.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "bom" && (
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-base font-bold text-gray-900">Ingredients</h2>
                <p className="text-[12px] text-gray-500">per 1 {productForm.unitOfMeasure || product.unitOfMeasure || "unit"} of product</p>
              </div>
              {activeBom && (
                <div className="flex items-center gap-3">
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium" onClick={() => setBomRowOpen(true)}>+ Add row</button>
                </div>
              )}
            </div>

            {product?.variants?.length > 0 && (
              <div className="mb-4 mt-3">
                <select 
                  className="kinput max-w-xs"
                  value={activeVariantId || ""}
                  onChange={e => setSelectedVariantId(e.target.value)}
                >
                  {product.variants.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name} {v.sku ? `(${v.sku})` : ""}</option>
                  ))}
                </select>
              </div>
            )}

            {!activeBom ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No recipe defined for this variant.</p>
                <button 
                  className="btn btn-primary mt-3" 
                  onClick={() => createBom.mutate(activeVariantId)}
                  disabled={createBom.isPending}
                >
                  {createBom.isPending ? "Creating..." : "Create Recipe"}
                </button>
              </div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-md overflow-hidden mt-3">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Notes</th>
                        <th className="text-right">Stock cost</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeBom.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-gray-400 py-4">
                            <span className="text-sm">Search or create a material or a product</span>
                          </td>
                        </tr>
                      ) : (
                        (activeBom.rows || []).map((r: BOMRow) => (
                          <tr key={r.id}>
                            <td className="font-medium">{r.materialId ? materialById.get(r.materialId)?.name || "—" : "—"}</td>
                            <td>
                              {formatQty(
                                r.qty,
                                r.materialId ? materialById.get(r.materialId)?.unitOfMeasure : undefined,
                              )}
                            </td>
                            <td className="text-gray-500">{r.notes || "—"}</td>
                            <td className="text-right">
                              ${rowStockCost(r, materialById).toFixed(2)} <span className="text-xs text-gray-400">CAD</span>
                            </td>
                            <td>
                              <ActionMenu actions={[
                                { label: "Edit", icon: <Pencil size={13} />, onClick: () => {
                                  setBomRowForm({ id: r.id, materialId: r.materialId || "", qty: r.qty.toString(), unitCost: r.unitCost?.toString() || "", notes: r.notes || "" });
                                  setBomRowOpen(true);
                                }},
                                { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => {
                                  if (confirm("Delete this BOM row?")) deleteBomRow.mutate(r.id);
                                }},
                              ]} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-800 mt-2 font-medium" onClick={() => setBomRowOpen(true)}>+ Add row</button>
                <div className="flex justify-end mt-4 border-t border-gray-200 pt-3">
                  <p className="text-sm text-gray-600">Total cost: <span className="font-semibold">
                    {((activeBom.rows || []) as BOMRow[]).reduce((sum, r) => sum + rowStockCost(r, materialById), 0).toFixed(2)} CAD
                  </span></p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "operations" && (
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Operation steps</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-blue-600 font-medium">Operations are in sequence</span>
                </label>
              </div>
            </div>

            {!activeBom ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No recipe defined — create a recipe first.</p>
              </div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Operation</th>
                        <th>Type</th>
                        <th>Resource</th>
                        <th>Cost parameter</th>
                        <th>Time</th>
                        <th>Cost</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeBom.operations || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center text-gray-400 py-4">
                            <span className="text-sm">e.g. cutting, assembly</span>
                          </td>
                        </tr>
                      ) : (
                        (activeBom.operations || []).map((r: ProductOperation) => (
                          <tr key={r.id}>
                            <td className="font-medium">{r.name}</td>
                            <td className="text-blue-600">Process</td>
                            <td className="text-gray-400">—</td>
                            <td>{r.costPerHour ? `$${Number(r.costPerHour).toFixed(2)}/hr` : "Cost per hour"}</td>
                            <td>{r.durationMinutes ? `${r.durationMinutes} min` : "—"}</td>
                            <td className="text-right">{r.costPerHour && r.durationMinutes ? `$${(Number(r.costPerHour) * Number(r.durationMinutes) / 60).toFixed(2)}` : "—"}</td>
                            <td>
                              <ActionMenu actions={[
                                { label: "Edit", icon: <Pencil size={13} />, onClick: () => {
                                  setOperationForm({ id: r.id, name: r.name, rank: r.rank.toString(), durationMinutes: r.durationMinutes?.toString() || "", costPerHour: r.costPerHour?.toString() || "", notes: r.notes || "" });
                                  setOperationOpen(true);
                                }},
                                { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => {
                                  if (confirm("Delete this operation?")) deleteOperation.mutate(r.id);
                                }},
                              ]} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <button 
                  className="text-sm text-blue-600 hover:text-blue-800 mt-2 font-medium"
                  onClick={() => {
                    const nextRank = (activeBom.operations?.length || 0) + 1;
                    setOperationForm({ ...operationBlank, rank: nextRank.toString(), id: "" });
                    setOperationOpen(true);
                  }}
                >
                  + Add row
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === "supply" && (
          <div className="px-6 py-5">
            <div className="space-y-5">
              <div>
                <label className="klabel">Default supplier</label>
                <input className="kinput" placeholder="Select or create supplier" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium mb-2">Do you buy this item in a different unit of measure?</p>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-600" />
                  Yes, I purchase in a different unit
                </label>
              </div>
              {product?.variants?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Variants</h3>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th>Default lead time</th>
                          <th>MOQ</th>
                          <th>Default purchase price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map((v: any) => (
                          <tr key={v.id}>
                            <td className="font-medium">{product.name} / {v.name}</td>
                            <td className="text-gray-400">14 calendar days</td>
                            <td className="text-gray-400">—</td>
                            <td>{v.purchasePrice ? `$${Number(v.purchasePrice).toFixed(2)}` : "0 CAD"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOM Row Modal */}
      <Modal open={bomRowOpen} onClose={() => setBomRowOpen(false)} title={bomRowForm.id ? "Edit Ingredient" : "Add Ingredient"}>
        <div className="space-y-3">
          <div>
            <label className="label">Material</label>
            <SearchableSelect
              value={bomRowForm.materialId}
              onChange={(materialId) => {
                const m = materialById.get(materialId);
                setBomRowForm((f) => ({
                  ...f,
                  materialId,
                  unitCost:
                    f.unitCost ||
                    (m?.purchasePrice != null ? String(m.purchasePrice) : ""),
                }));
              }}
              options={materialOptions}
              placeholder="Search materials…"
              creatable
              createLabel={(q) => `Create new '${q}'`}
              onCreateNew={(q) => {
                setMaterialCreateQuery(q);
                setNewMaterialForm({ name: q, unit: "kg", purchasePrice: "" });
                setMaterialCreateOpen(true);
              }}
            />
          </div>
          <div>
            <label className="label">Quantity *</label>
            <input 
              className="input" 
              type="number"
              value={bomRowForm.qty}
              onChange={e => setBomRowForm(f => ({ ...f, qty: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Unit Cost</label>
            <input 
              className="input" 
              type="number"
              step="0.01"
              value={bomRowForm.unitCost}
              onChange={e => setBomRowForm(f => ({ ...f, unitCost: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <input 
              className="input"
              value={bomRowForm.notes}
              onChange={e => setBomRowForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setBomRowOpen(false)}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={() => saveBomRow.mutate(bomRowForm)}
            disabled={saveBomRow.isPending || !bomRowForm.qty}
          >
            {saveBomRow.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      {/* Operation Modal */}
      <Modal open={operationOpen} onClose={() => setOperationOpen(false)} title={operationForm.id ? "Edit Operation" : "Add Operation"}>
        <div className="space-y-3">
          <div>
            <label className="label">Operation Name *</label>
            <input 
              className="input"
              value={operationForm.name}
              onChange={e => setOperationForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Cutting, Assembly, Packaging"
            />
          </div>
          <div>
            <label className="label">Step Number</label>
            <input 
              className="input" 
              type="number"
              value={operationForm.rank}
              onChange={e => setOperationForm(f => ({ ...f, rank: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input 
              className="input" 
              type="number"
              value={operationForm.durationMinutes}
              onChange={e => setOperationForm(f => ({ ...f, durationMinutes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Cost per Hour</label>
            <input 
              className="input" 
              type="number"
              step="0.01"
              value={operationForm.costPerHour}
              onChange={e => setOperationForm(f => ({ ...f, costPerHour: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <input 
              className="input"
              value={operationForm.notes}
              onChange={e => setOperationForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOperationOpen(false)}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={() => saveOperation.mutate(operationForm)}
            disabled={saveOperation.isPending || !operationForm.name}
          >
            {saveOperation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      <VariantConfigModal
        open={variantConfigOpen}
        onClose={() => setVariantConfigOpen(false)}
        initialOptions={(product?.variantOptions as VariantOptionConfig[]) ?? null}
        onGenerate={(opts) => generateVariants.mutate(opts)}
        isPending={generateVariants.isPending}
      />

      {/* Quick-create material from BOM (Katana-style) */}
      <Modal
        open={materialCreateOpen}
        onClose={() => setMaterialCreateOpen(false)}
        title="New material"
      >
        <div className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={newMaterialForm.name}
              onChange={(e) => setNewMaterialForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <UnitOfMeasureField
              label="Unit of measure"
              labelClassName="label"
              inputClassName="input"
              value={newMaterialForm.unit}
              onChange={(unit) => setNewMaterialForm((f) => ({ ...f, unit }))}
            />
          </div>
          <div>
            <label className="label">Default purchase price</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={newMaterialForm.purchasePrice}
              onChange={(e) =>
                setNewMaterialForm((f) => ({ ...f, purchasePrice: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-ghost" onClick={() => setMaterialCreateOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => createMaterial.mutate(newMaterialForm)}
            disabled={createMaterial.isPending || !newMaterialForm.name.trim()}
          >
            {createMaterial.isPending ? "Saving…" : "Done"}
          </button>
        </div>
      </Modal>

      {/* Variant Modal */}
      <Modal open={variantOpen} onClose={() => setVariantOpen(false)} title={variantForm.id ? "Edit Variant" : "Add Variant"}>
        <div className="space-y-3">
          <div>
            <label className="label">Variant Name *</label>
            <input 
              className="input"
              value={variantForm.name}
              onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Red / Large"
            />
          </div>
          <div>
            <label className="label">SKU</label>
            <input 
              className="input"
              value={variantForm.sku}
              onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Sales Price</label>
            <input 
              className="input" 
              type="number"
              step="0.01"
              value={variantForm.salesPrice}
              onChange={e => setVariantForm(f => ({ ...f, salesPrice: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Purchase Price / Cost</label>
            <input 
              className="input" 
              type="number"
              step="0.01"
              value={variantForm.purchasePrice}
              onChange={e => setVariantForm(f => ({ ...f, purchasePrice: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setVariantOpen(false)}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={() => saveVariant.mutate(variantForm)}
            disabled={saveVariant.isPending || !variantForm.name}
          >
            {saveVariant.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}