"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BOM {
  id: string;
  name: string;
  qty: number;
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
    name: "", sku: "", description: "", category: "", salesPrice: "", purchasePrice: "", 
    trackLots: false, trackExpiry: false
  });
  const [bomRowOpen, setBomRowOpen] = useState(false);
  const [bomRowForm, setBomRowForm] = useState({ ...bomRowBlank, id: "" });
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationForm, setOperationForm] = useState({ ...operationBlank, id: "" });
  const [selectedBom, setSelectedBom] = useState<string | null>(null);

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

  const { data: variants = [] } = useQuery({
    queryKey: ["variants"],
    queryFn: () => api.get("/variants").then(r => r.data.data || []),
  });

  // Mutations
  const updateProduct = useMutation({
    mutationFn: (data: any) => api.put(`/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      addToast("Product updated", "success");
    },
  });

  const saveBomRow = useMutation({
    mutationFn: (data: any) => data.id ? 
      api.patch(`/bom-rows/${data.id}`, data) : 
      api.post("/bom-rows", { ...data, bomId: selectedBom }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms", id] });
      addToast("BOM row saved", "success");
      setBomRowOpen(false);
      setBomRowForm({ ...bomRowBlank, id: "" });
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
      api.post("/product-operations", { ...data, bomId: selectedBom }),
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

  // Get active BOM
  const activeBom = boms.find((b: BOM) => b.id === selectedBom) || boms[0];

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (!product) return <div className="p-4">Product not found</div>;

  const tabs = [
    { id: "general", label: "General Info" },
    { id: "bom", label: "Recipe / BOM" },
    { id: "operations", label: "Production Operations" },
  ];

  const bomRowColumns: Column[] = [
    { 
      key: "material", 
      header: "Material/Variant", 
      render: (r: BOMRow) => r.materialId ? 
        materials.find((m: any) => m.id === r.materialId)?.name || "Unknown" :
        variants.find((v: any) => v.id === r.variantId)?.name || "Unknown"
    },
    { key: "qty", header: "Quantity", render: (r: BOMRow) => Number(r.qty).toFixed(2) },
    { key: "unitCost", header: "Unit Cost", render: (r: BOMRow) => r.unitCost ? `$${Number(r.unitCost).toFixed(2)}` : "—" },
    { key: "notes", header: "Notes", render: (r: BOMRow) => r.notes || "—" },
    {
      key: "actions",
      header: "",
      render: (r: BOMRow) => (
        <ActionMenu actions={[
          { label: "Edit", icon: <Pencil size={13} />, onClick: () => {
            setBomRowForm({ 
              id: r.id, 
              materialId: r.materialId || "", 
              variantId: r.variantId || "", 
              qty: r.qty.toString(), 
              unitCost: r.unitCost?.toString() || "", 
              notes: r.notes || "" 
            });
            setBomRowOpen(true);
          }},
          { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => {
            if (confirm("Delete this BOM row?")) deleteBomRow.mutate(r.id);
          }},
        ]} />
      )
    },
  ];

  const operationColumns: Column[] = [
    { key: "rank", header: "Step", render: (r: ProductOperation) => r.rank },
    { key: "name", header: "Operation", render: (r: ProductOperation) => <span className="font-medium">{r.name}</span> },
    { key: "durationMinutes", header: "Duration (min)", render: (r: ProductOperation) => r.durationMinutes || "—" },
    { key: "costPerHour", header: "Cost/hr", render: (r: ProductOperation) => r.costPerHour ? `$${Number(r.costPerHour).toFixed(2)}` : "—" },
    { key: "notes", header: "Notes", render: (r: ProductOperation) => r.notes || "—" },
    {
      key: "actions",
      header: "",
      render: (r: ProductOperation) => (
        <ActionMenu actions={[
          { label: "Edit", icon: <Pencil size={13} />, onClick: () => {
            setOperationForm({ 
              id: r.id, 
              name: r.name, 
              rank: r.rank.toString(), 
              durationMinutes: r.durationMinutes?.toString() || "", 
              costPerHour: r.costPerHour?.toString() || "", 
              notes: r.notes || "" 
            });
            setOperationOpen(true);
          }},
          { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => {
            if (confirm("Delete this operation?")) deleteOperation.mutate(r.id);
          }},
        ]} />
      )
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/items" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-500">Product Details</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-4">
        <div className="flex -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-brand-600 text-gray-900 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "general" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">General Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name *</label>
                <input 
                  className="input" 
                  value={productForm.name} 
                  onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} 
                />
              </div>
              <div>
                <label className="label">SKU</label>
                <input 
                  className="input" 
                  value={productForm.sku} 
                  onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} 
                />
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <textarea 
                  className="input" 
                  rows={3}
                  value={productForm.description} 
                  onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} 
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input 
                  className="input" 
                  value={productForm.category} 
                  onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} 
                />
              </div>
              <div>
                <label className="label">Unit of Measure</label>
                <select className="input" defaultValue="pcs">
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                  <option value="m">m</option>
                  <option value="ft">ft</option>
                </select>
              </div>
              <div>
                <label className="label">Sales Price</label>
                <input 
                  className="input" 
                  type="number" 
                  step="0.01"
                  value={productForm.salesPrice} 
                  onChange={e => setProductForm(f => ({ ...f, salesPrice: e.target.value }))} 
                />
              </div>
              <div>
                <label className="label">Purchase Price</label>
                <input 
                  className="input" 
                  type="number" 
                  step="0.01"
                  value={productForm.purchasePrice} 
                  onChange={e => setProductForm(f => ({ ...f, purchasePrice: e.target.value }))} 
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={productForm.trackLots} 
                    onChange={e => setProductForm(f => ({ ...f, trackLots: e.target.checked }))} 
                  />
                  Enable lot number tracking
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={productForm.trackExpiry} 
                    onChange={e => setProductForm(f => ({ ...f, trackExpiry: e.target.checked }))} 
                  />
                  Enable expiry date tracking
                </label>
              </div>
            </div>
            <div className="mt-6">
              <button 
                className="btn btn-primary"
                onClick={() => updateProduct.mutate(productForm)}
                disabled={updateProduct.isPending}
              >
                {updateProduct.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "bom" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recipe / Bill of Materials</h2>
              {activeBom && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setBomRowOpen(true)}
                >
                  <Plus size={15} />Add Ingredient
                </button>
              )}
            </div>

            {boms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No BOMs defined for this product.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {boms.length > 1 && (
                  <div>
                    <label className="label">Select BOM</label>
                    <select 
                      className="input max-w-xs"
                      value={selectedBom || activeBom?.id || ""}
                      onChange={e => setSelectedBom(e.target.value)}
                    >
                      {boms.map((bom: BOM) => (
                        <option key={bom.id} value={bom.id}>{bom.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeBom && (
                  <div className="bg-white rounded-lg border">
                    <div className="p-4 border-b">
                      <h3 className="font-medium">{activeBom.name}</h3>
                      <p className="text-sm text-gray-500">Quantity: {activeBom.qty}</p>
                    </div>
                    <div className="p-4">
                      <DataTable 
                        columns={bomRowColumns}
                        data={activeBom.rows || []}
                        emptyMessage="No ingredients in this BOM"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "operations" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Production Operations</h2>
              {activeBom && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    const nextRank = (activeBom.operations?.length || 0) + 1;
                    setOperationForm({ ...operationBlank, rank: nextRank.toString(), id: "" });
                    setOperationOpen(true);
                  }}
                >
                  <Plus size={15} />Add Operation
                </button>
              )}
            </div>

            {!activeBom ? (
              <div className="text-center py-8 text-gray-500">
                <p>No BOMs defined for this product.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border">
                <div className="p-4 border-b">
                  <h3 className="font-medium">Operations for {activeBom.name}</h3>
                </div>
                <div className="p-4">
                  <DataTable 
                    columns={operationColumns}
                    data={activeBom.operations || []}
                    emptyMessage="No operations defined"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOM Row Modal */}
      <Modal open={bomRowOpen} onClose={() => setBomRowOpen(false)} title={bomRowForm.id ? "Edit Ingredient" : "Add Ingredient"}>
        <div className="space-y-3">
          <div>
            <label className="label">Material</label>
            <select 
              className="input"
              value={bomRowForm.materialId}
              onChange={e => setBomRowForm(f => ({ ...f, materialId: e.target.value, variantId: "" }))}
            >
              <option value="">— Select Material —</option>
              {materials.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">OR Variant</label>
            <select 
              className="input"
              value={bomRowForm.variantId}
              onChange={e => setBomRowForm(f => ({ ...f, variantId: e.target.value, materialId: "" }))}
            >
              <option value="">— Select Variant —</option>
              {variants.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
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
    </div>
  );
}