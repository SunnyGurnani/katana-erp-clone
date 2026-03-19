export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface User { id: string; email: string; fullName: string; isActive: boolean; isSuperuser: boolean; createdAt: string; }
export interface Product { id: string; name: string; sku: string|null; description: string|null; category: string|null; unitOfMeasure: string; isActive: boolean; isManufactured: boolean; salesPrice: string|null; purchasePrice: string|null; createdAt: string; updatedAt: string; }
export interface Variant { id: string; productId: string; name: string; sku: string|null; barcode: string|null; salesPrice: string|null; purchasePrice: string|null; isActive: boolean; }
export interface Material { id: string; name: string; sku: string|null; description: string|null; category: string|null; unitOfMeasure: string; isActive: boolean; purchasePrice: string|null; reorderPoint: string|null; leadTimeDays: number|null; createdAt: string; updatedAt: string; }
export interface Location { id: string; name: string; address: string|null; isActive: boolean; isDefault: boolean; createdAt: string; }
export interface InventoryLevel { id: string; variantId: string; locationId: string; onHand: string; allocated: string; reorderPoint: string|null; reorderQty: string|null; updatedAt: string; }
export interface Supplier { id: string; name: string; code: string|null; email: string|null; phone: string|null; currency: string; isActive: boolean; createdAt: string; }
export interface Customer { id: string; name: string; code: string|null; email: string|null; phone: string|null; currency: string; isActive: boolean; createdAt: string; }
export interface PurchaseOrder { id: string; number: string; supplierId: string|null; status: string; currency: string; orderDate: string|null; expectedDate: string|null; notes: string|null; locationId: string|null; rows: PORow[]; costRows: POCostRow[]; createdAt: string; updatedAt: string; }
export interface PORow { id: string; orderId: string; materialId: string|null; variantId: string|null; description: string|null; qtyOrdered: string; qtyReceived: string; unitPrice: string|null; }
export interface POCostRow { id: string; orderId: string; description: string; amount: string; }
export interface SalesOrder { id: string; number: string; customerId: string|null; status: string; currency: string; orderDate: string|null; requiredDate: string|null; notes: string|null; locationId: string|null; rows: SORow[]; fulfillments: SOFulfillment[]; createdAt: string; updatedAt: string; }
export interface SORow { id: string; orderId: string; variantId: string|null; description: string|null; qtyOrdered: string; qtyFulfilled: string; unitPrice: string|null; }
export interface SOFulfillment { id: string; orderId: string; rowId: string; qty: string; locationId: string|null; isReturn: boolean; notes: string|null; createdAt: string; }
export interface ManufacturingOrder { id: string; number: string; bomId: string|null; productId: string; variantId: string|null; locationId: string|null; status: string; qtyPlanned: string; qtyProduced: string; plannedStart: string|null; plannedEnd: string|null; notes: string|null; recipeRows: MORecipeRow[]; createdAt: string; updatedAt: string; }
export interface MORecipeRow { id: string; moId: string; materialId: string|null; variantId: string|null; qtyPlanned: string; qtyConsumed: string; }
export interface BOM { id: string; productId: string; variantId: string|null; name: string; qty: string; isActive: boolean; rows: BOMRow[]; createdAt: string; }
export interface BOMRow { id: string; bomId: string; materialId: string|null; variantId: string|null; qty: string; unitCost: string|null; }
export interface DashboardStats { lowStockCount: number; openPoCount: number; openMoCount: number; lateSoCount: number; recentMovements: RecentMovement[]; }
export interface RecentMovement { id: string; variantId: string; locationId: string; qty: number; movementType: string; note: string|null; createdAt: string; }
