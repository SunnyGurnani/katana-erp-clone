import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function upsertByNumber<T>(model: any, number: string, data: any): Promise<T> {
  const existing = await model.findFirst({ where: { number } });
  if (existing) return existing as T;
  return model.create({ data }) as T;
}

async function main() {
  console.log('Seeding ForgeERP...');

  // Roles
  const adminRole = await prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin', description: 'Full access' } });
  const operatorRole = await prisma.role.upsert({ where: { name: 'operator' }, update: {}, create: { name: 'operator', description: 'Production floor' } });
  await prisma.role.upsert({ where: { name: 'viewer' }, update: {}, create: { name: 'viewer', description: 'Read-only' } });

  // Users — always refresh password hashes so re-seed fixes "invalid credentials" after DB drift
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const operatorHash = await bcrypt.hash('Operator1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@forgeerp.com' },
    update: { fullName: 'Admin User', hashedPassword: adminHash, isActive: true, isSuperuser: true, roleId: adminRole.id },
    create: { email: 'admin@forgeerp.com', fullName: 'Admin User', hashedPassword: adminHash, isActive: true, isSuperuser: true, roleId: adminRole.id },
  });
  await prisma.user.upsert({
    where: { email: 'operator@forgeerp.com' },
    update: { fullName: 'Floor Operator', hashedPassword: operatorHash, isActive: true, roleId: operatorRole.id },
    create: { email: 'operator@forgeerp.com', fullName: 'Floor Operator', hashedPassword: operatorHash, isActive: true, roleId: operatorRole.id },
  });

  // Locations
  const warehouse = await prisma.location.upsert({
    where: { id: 'loc-warehouse-001' }, update: {},
    create: { id: 'loc-warehouse-001', name: 'Main Warehouse', address: '100 Industrial Blvd, Surrey BC', isDefault: true },
  }).catch(() => prisma.location.findFirst({ where: { name: 'Main Warehouse' } })) as any;
  const factory = await prisma.location.upsert({
    where: { id: 'loc-factory-001' }, update: {},
    create: { id: 'loc-factory-001', name: 'Factory Floor', address: '100 Industrial Blvd — Building B' },
  }).catch(() => prisma.location.findFirst({ where: { name: 'Factory Floor' } })) as any;

  // Suppliers
  const sup1 = await prisma.supplier.upsert({ where: { code: 'SUP-001' }, update: {}, create: { name: 'SteelCo Materials Ltd', code: 'SUP-001', email: 'orders@steelco.com', phone: '+1-604-555-0101', currency: 'USD', paymentTerms: 'Net 30' } });
  const sup2 = await prisma.supplier.upsert({ where: { code: 'SUP-002' }, update: {}, create: { name: 'Pacific Components Inc', code: 'SUP-002', email: 'procurement@pacificcomp.com', phone: '+1-604-555-0202', currency: 'USD', paymentTerms: 'Net 60' } });
  const sup3 = await prisma.supplier.upsert({ where: { code: 'SUP-003' }, update: {}, create: { name: 'Apex Coatings & Finishes', code: 'SUP-003', email: 'sales@apexcoatings.com', currency: 'CAD', paymentTerms: 'Net 15' } });

  // Customers
  const cust1 = await prisma.customer.upsert({ where: { code: 'CUST-001' }, update: {}, create: { name: 'Ridgeline Sports Outlet', code: 'CUST-001', email: 'orders@ridgelinesports.com', phone: '+1-778-555-1001', currency: 'CAD', paymentTerms: 'Net 30' } });
  const cust2 = await prisma.customer.upsert({ where: { code: 'CUST-002' }, update: {}, create: { name: 'Summit Cycles Wholesale', code: 'CUST-002', email: 'buying@summitcycles.com', currency: 'USD', paymentTerms: 'Net 45' } });
  const cust3 = await prisma.customer.upsert({ where: { code: 'CUST-003' }, update: {}, create: { name: 'Metro Adventure Co', code: 'CUST-003', email: 'purchasing@metroadv.com', currency: 'USD', paymentTerms: 'Due on receipt' } });

  // Products
  const bikeProduct = await prisma.product.upsert({ where: { sku: 'BIKE-PRO-29' }, update: {}, create: { name: 'Mountain Bike Pro 29"', sku: 'BIKE-PRO-29', category: 'Finished Goods', isManufactured: true, salesPrice: 1299.99, purchasePrice: 750 } });
  const frameProduct = await prisma.product.upsert({ where: { sku: 'FRAME-AL-29' }, update: {}, create: { name: 'Aluminum Frame 29"', sku: 'FRAME-AL-29', category: 'Sub-assembly', isManufactured: true, salesPrice: 399 } });
  const helmetProduct = await prisma.product.upsert({ where: { sku: 'HELMET-MTB-L' }, update: {}, create: { name: 'MTB Helmet Large', sku: 'HELMET-MTB-L', category: 'Accessories', isManufactured: false, salesPrice: 89.99 } });

  // Variants
  const bikeRed = await prisma.variant.upsert({ where: { sku: 'BIKE-PRO-29-R-L' }, update: {}, create: { productId: bikeProduct.id, name: 'Red / Large', sku: 'BIKE-PRO-29-R-L', salesPrice: 1299.99 } });
  const bikeBlue = await prisma.variant.upsert({ where: { sku: 'BIKE-PRO-29-B-M' }, update: {}, create: { productId: bikeProduct.id, name: 'Blue / Medium', sku: 'BIKE-PRO-29-B-M', salesPrice: 1299.99 } });
  const frameV = await prisma.variant.upsert({ where: { sku: 'FRAME-AL-29-STD' }, update: {}, create: { productId: frameProduct.id, name: 'Standard', sku: 'FRAME-AL-29-STD' } });
  const helmetV = await prisma.variant.upsert({ where: { sku: 'HELMET-MTB-L-BLK' }, update: {}, create: { productId: helmetProduct.id, name: 'Black', sku: 'HELMET-MTB-L-BLK', salesPrice: 89.99 } });

  // Materials
  const mat1 = await prisma.material.upsert({ where: { sku: 'MAT-ST-25' }, update: {}, create: { name: 'Carbon Steel Tube 25mm', sku: 'MAT-ST-25', category: 'Raw Material', unitOfMeasure: 'm', purchasePrice: 4.50, reorderPoint: 100, leadTimeDays: 7 } });
  const mat2 = await prisma.material.upsert({ where: { sku: 'MAT-BRAKE-HYD' }, update: {}, create: { name: 'Hydraulic Brake Set', sku: 'MAT-BRAKE-HYD', category: 'Components', purchasePrice: 42.00, reorderPoint: 20, leadTimeDays: 14 } });
  const mat3 = await prisma.material.upsert({ where: { sku: 'MAT-CASS-11' }, update: {}, create: { name: 'Shimano 11-speed Cassette', sku: 'MAT-CASS-11', category: 'Components', purchasePrice: 55.00, reorderPoint: 15, leadTimeDays: 10 } });
  const mat4 = await prisma.material.upsert({ where: { sku: 'MAT-TIRE-29' }, update: {}, create: { name: '29" Tire All-terrain', sku: 'MAT-TIRE-29', category: 'Components', purchasePrice: 28.00, reorderPoint: 40, leadTimeDays: 5 } });
  const mat5 = await prisma.material.upsert({ where: { sku: 'MAT-AL-3MM' }, update: {}, create: { name: 'Aluminum Alloy Sheet 3mm', sku: 'MAT-AL-3MM', category: 'Raw Material', unitOfMeasure: 'kg', purchasePrice: 3.20, reorderPoint: 200 } });
  const mat6 = await prisma.material.upsert({ where: { sku: 'MAT-PAINT-RED' }, update: {}, create: { name: 'Epoxy Paint Matte Red', sku: 'MAT-PAINT-RED', category: 'Consumable', unitOfMeasure: 'L', purchasePrice: 18.00, reorderPoint: 10 } });

  // Inventory Levels
  await prisma.inventoryLevel.upsert({ where: { variantId_locationId: { variantId: bikeRed.id, locationId: warehouse.id } }, update: {}, create: { variantId: bikeRed.id, locationId: warehouse.id, onHand: 25, allocated: 5, reorderPoint: 10, reorderQty: 20 } });
  await prisma.inventoryLevel.upsert({ where: { variantId_locationId: { variantId: bikeBlue.id, locationId: warehouse.id } }, update: {}, create: { variantId: bikeBlue.id, locationId: warehouse.id, onHand: 18, allocated: 3, reorderPoint: 10, reorderQty: 20 } });
  await prisma.inventoryLevel.upsert({ where: { variantId_locationId: { variantId: frameV.id, locationId: factory.id } }, update: {}, create: { variantId: frameV.id, locationId: factory.id, onHand: 50, allocated: 10 } });
  await prisma.inventoryLevel.upsert({ where: { variantId_locationId: { variantId: helmetV.id, locationId: warehouse.id } }, update: {}, create: { variantId: helmetV.id, locationId: warehouse.id, onHand: 8, allocated: 0, reorderPoint: 10 } });

  // BOM — skip if already exists for this product
  let bom = await prisma.bOM.findFirst({ where: { productId: bikeProduct.id } });
  if (!bom) {
    bom = await prisma.bOM.create({
      data: {
        productId: bikeProduct.id, name: 'Mountain Bike Pro 29" — Standard BOM', qty: 1,
        rows: { create: [
          { materialId: mat1.id, qty: 3.2, unitCost: 4.50, notes: '3.2m tubing per bike' },
          { materialId: mat2.id, qty: 1, unitCost: 42.00 },
          { materialId: mat3.id, qty: 1, unitCost: 55.00 },
          { materialId: mat4.id, qty: 2, unitCost: 28.00, notes: '2 tires per bike' },
          { materialId: mat6.id, qty: 0.3, unitCost: 18.00, notes: '300ml paint per bike' },
        ]},
        operations: { create: [
          { name: 'Frame Welding', durationMinutes: 45, costPerHour: 80 },
          { name: 'Component Assembly', durationMinutes: 30, costPerHour: 60 },
          { name: 'Quality Check', durationMinutes: 15, costPerHour: 50 },
        ]},
      },
    });
  }

  // Purchase Orders — skip on duplicate number
  const po1 = await upsertByNumber<any>(prisma.purchaseOrder, 'PO-2026-001', {
    number: 'PO-2026-001', supplierId: sup1.id, status: 'vendor_confirmed', currency: 'USD',
    orderDate: new Date('2026-03-01'), expectedDate: new Date('2026-03-20'), locationId: warehouse.id,
    rows: { create: [
      { materialId: mat1.id, description: 'Carbon Steel Tube 25mm', qtyOrdered: 500, qtyReceived: 200, unitPrice: 4.50 },
      { materialId: mat5.id, description: 'Aluminum Alloy Sheet 3mm', qtyOrdered: 100, qtyReceived: 100, unitPrice: 3.20 },
    ]},
  });
  await upsertByNumber<any>(prisma.purchaseOrder, 'PO-2026-002', {
    number: 'PO-2026-002', supplierId: sup2.id, status: 'draft', currency: 'USD',
    orderDate: new Date('2026-03-15'), expectedDate: new Date('2026-04-01'), locationId: factory.id,
    rows: { create: [
      { materialId: mat2.id, description: 'Hydraulic Brake Set', qtyOrdered: 50, qtyReceived: 0, unitPrice: 42.00 },
      { materialId: mat3.id, description: 'Shimano Cassette', qtyOrdered: 50, qtyReceived: 0, unitPrice: 55.00 },
      { materialId: mat4.id, description: '29" Tires', qtyOrdered: 100, qtyReceived: 0, unitPrice: 28.00 },
    ]},
    costRows: { create: [{ description: 'Freight & Handling', amount: 150 }] },
  });
  await upsertByNumber<any>(prisma.purchaseOrder, 'PO-2026-003', {
    number: 'PO-2026-003', supplierId: sup3.id, status: 'done', currency: 'CAD',
    orderDate: new Date('2026-02-15'), expectedDate: new Date('2026-03-05'), locationId: factory.id,
    rows: { create: [{ materialId: mat6.id, description: 'Epoxy Paint Matte Red', qtyOrdered: 20, qtyReceived: 20, unitPrice: 18.00 }] },
  });

  // Sales Orders
  await upsertByNumber<any>(prisma.salesOrder, 'SO-2026-001', {
    number: 'SO-2026-001', customerId: cust1.id, status: 'confirmed', currency: 'CAD',
    orderDate: new Date('2026-03-10'), requiredDate: new Date('2026-03-25'), locationId: warehouse.id,
    rows: { create: [
      { variantId: bikeRed.id, description: 'Mountain Bike Pro 29" Red/L', qtyOrdered: 5, qtyFulfilled: 0, unitPrice: 1299.99 },
      { variantId: bikeBlue.id, description: 'Mountain Bike Pro 29" Blue/M', qtyOrdered: 3, qtyFulfilled: 0, unitPrice: 1299.99 },
    ]},
  });
  await upsertByNumber<any>(prisma.salesOrder, 'SO-2026-002', {
    number: 'SO-2026-002', customerId: cust2.id, status: 'partial', currency: 'USD',
    orderDate: new Date('2026-03-05'), requiredDate: new Date('2026-03-15'), locationId: warehouse.id,
    rows: { create: [{ variantId: bikeRed.id, description: 'Mountain Bike Pro 29" Red/L', qtyOrdered: 10, qtyFulfilled: 4, unitPrice: 1250.00 }] },
  });
  await upsertByNumber<any>(prisma.salesOrder, 'SO-2026-003', {
    number: 'SO-2026-003', customerId: cust3.id, status: 'draft', currency: 'USD',
    orderDate: new Date('2026-03-18'),
    rows: { create: [{ variantId: helmetV.id, qtyOrdered: 12, qtyFulfilled: 0, unitPrice: 85.00 }] },
  });

  // Manufacturing Orders
  await upsertByNumber<any>(prisma.manufacturingOrder, 'MO-2026-001', {
    number: 'MO-2026-001', bomId: bom.id, productId: bikeProduct.id, variantId: bikeRed.id,
    locationId: factory.id, status: 'in_progress', qtyPlanned: 20, qtyProduced: 8,
    plannedStart: new Date('2026-03-10'), plannedEnd: new Date('2026-03-30'),
    recipeRows: { create: [
      { materialId: mat1.id, qtyPlanned: 64, qtyConsumed: 25.6 },
      { materialId: mat2.id, qtyPlanned: 20, qtyConsumed: 8 },
      { materialId: mat3.id, qtyPlanned: 20, qtyConsumed: 8 },
      { materialId: mat4.id, qtyPlanned: 40, qtyConsumed: 16 },
    ]},
  });
  await upsertByNumber<any>(prisma.manufacturingOrder, 'MO-2026-002', {
    number: 'MO-2026-002', productId: frameProduct.id, variantId: frameV.id,
    locationId: factory.id, status: 'planned', qtyPlanned: 30, qtyProduced: 0,
    plannedStart: new Date('2026-04-01'), plannedEnd: new Date('2026-04-20'),
    recipeRows: { create: [
      { materialId: mat1.id, qtyPlanned: 90 },
      { materialId: mat5.id, qtyPlanned: 45 },
    ]},
  });

  // Stock Adjustments (only insert if count is 0)
  const adjCount = await prisma.stockAdjustment.count();
  if (adjCount === 0) {
    await prisma.stockAdjustment.createMany({ data: [
      { variantId: bikeRed.id, locationId: warehouse.id, qtyDelta: 25, reason: 'opening_stock', note: 'Initial inventory count', createdById: admin.id },
      { variantId: bikeBlue.id, locationId: warehouse.id, qtyDelta: 18, reason: 'opening_stock', createdById: admin.id },
      { variantId: helmetV.id, locationId: warehouse.id, qtyDelta: 8, reason: 'opening_stock', createdById: admin.id },
      { variantId: frameV.id, locationId: factory.id, qtyDelta: 50, reason: 'opening_stock', createdById: admin.id },
      { variantId: bikeRed.id, locationId: warehouse.id, qtyDelta: -2, reason: 'damage_write_off', note: 'Damaged in transit', createdById: admin.id },
    ]});
  }

  // Stock Transfers (only insert if count is 0)
  const txCount = await prisma.stockTransfer.count();
  if (txCount === 0) {
    await prisma.stockTransfer.createMany({ data: [
      { variantId: bikeRed.id, fromLocationId: factory.id, toLocationId: warehouse.id, qty: 5, note: 'Production batch transfer', createdById: admin.id },
      { variantId: frameV.id, fromLocationId: warehouse.id, toLocationId: factory.id, qty: 10, note: 'Frames to factory for assembly', createdById: admin.id },
    ]});
  }

  // Batches + Serial Numbers
  await prisma.batch.upsert({ where: { variantId_batchNumber: { variantId: bikeRed.id, batchNumber: 'BATCH-2026-001' } }, update: {}, create: { variantId: bikeRed.id, batchNumber: 'BATCH-2026-001', expiryDate: new Date('2028-12-31'), notes: 'Q1 production run' } });
  await prisma.batch.upsert({ where: { variantId_batchNumber: { variantId: bikeBlue.id, batchNumber: 'BATCH-2026-002' } }, update: {}, create: { variantId: bikeBlue.id, batchNumber: 'BATCH-2026-002', notes: 'Q1 production run' } });

  // Serial Numbers — skip if already exist
  const snCount = await prisma.serialNumber.count();
  if (snCount === 0) {
    await prisma.serialNumber.createMany({ data: [
      { variantId: bikeRed.id, serialNumber: 'SN-BIKE-001', status: 'available' },
      { variantId: bikeRed.id, serialNumber: 'SN-BIKE-002', status: 'available' },
      { variantId: bikeRed.id, serialNumber: 'SN-BIKE-003', status: 'sold' },
      { variantId: bikeBlue.id, serialNumber: 'SN-BIKE-B001', status: 'available' },
      { variantId: helmetV.id, serialNumber: 'SN-HELM-001', status: 'available' },
    ]});
  }

  // Inventory Movements — skip if already exist
  const mvCount = await prisma.inventoryMovement.count();
  if (mvCount === 0) {
    await prisma.inventoryMovement.createMany({ data: [
      { variantId: bikeRed.id, locationId: warehouse.id, qty: 25, movementType: 'opening_stock', note: 'Initial seed' },
      { variantId: bikeBlue.id, locationId: warehouse.id, qty: 18, movementType: 'opening_stock', note: 'Initial seed' },
      { variantId: frameV.id, locationId: factory.id, qty: 50, movementType: 'opening_stock', note: 'Initial seed' },
      { variantId: helmetV.id, locationId: warehouse.id, qty: 8, movementType: 'opening_stock', note: 'Initial seed' },
      { variantId: bikeRed.id, locationId: warehouse.id, qty: -2, movementType: 'adjustment', note: 'Damage write-off' },
      { variantId: bikeRed.id, locationId: factory.id, qty: -5, movementType: 'transfer_out', note: 'To warehouse' },
      { variantId: bikeRed.id, locationId: warehouse.id, qty: 5, movementType: 'transfer_in', note: 'From factory' },
    ]});
  }

  console.log('✓ Seed complete');
  console.log('  admin@forgeerp.com / Admin1234!');
  console.log('  operator@forgeerp.com / Operator1234!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
