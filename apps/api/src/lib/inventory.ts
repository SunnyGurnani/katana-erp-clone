import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type TX = Omit<PrismaClient, '$connect'|'$disconnect'|'$on'|'$transaction'|'$use'|'$extends'>;

/**
 * Inventory engine: every stock mutation calls this.
 * Upserts inventory_level and writes an immutable inventory_movement.
 */
export async function adjustStock(
  tx: TX,
  variantId: string,
  locationId: string,
  qty: any | number,
  movementType: string,
  opts?: { referenceType?: string; referenceId?: string; note?: string }
) {
  const qtyNum = Number(qty);
  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
  const current = existing ? Number(existing.onHand) : 0;
  if (qtyNum < 0 && current + qtyNum < 0) {
    const msg = existing
      ? `Insufficient stock at this location (on hand: ${current}, need: ${Math.abs(qtyNum)}).`
      : 'No on-hand stock for this variant at the selected location. Receive inventory first or pick another location.';
    throw Object.assign(new Error(msg), { statusCode: 422 });
  }

  const level = await tx.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, onHand: qtyNum, allocated: 0 },
    update: { onHand: { increment: qtyNum } },
  });

  const newOnHand = Number(level.onHand);
  if (newOnHand < 0) {
    throw Object.assign(new Error('Stock would go negative; operation rejected.'), { statusCode: 422 });
  }

  // Immutable movement record
  const movement = await tx.inventoryMovement.create({
    data: {
      variantId,
      locationId,
      qty: qtyNum,
      movementType,
      referenceType: opts?.referenceType,
      referenceId: opts?.referenceId,
      note: opts?.note,
    },
  });
  return { level, movement };
}

/**
 * Decrement (or increment if qty positive) batch on-hand at a location, then mirror on aggregate inventory_level + movement.
 * Use qty as positive amount to remove from stock (same as passing negative to adjustStock).
 */
export async function adjustVariantStockWithBatch(
  tx: TX,
  params: { variantId: string; locationId: string; qtyToShip: number; batchId: string },
  movementOpts: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(params.qtyToShip);
  if (q <= 0) return;

  const batch = await tx.batch.findFirst({
    where: { id: params.batchId, variantId: params.variantId },
  });
  if (!batch) {
    throw Object.assign(new Error('Selected lot does not belong to this product variant.'), { statusCode: 422 });
  }

  const bs = await tx.batchStock.findUnique({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
  });
  const bOn = bs ? Number(bs.onHand) : 0;
  if (bOn < q) {
    throw Object.assign(
      new Error(`Insufficient quantity in the selected lot at this location (on hand: ${bOn}).`),
      { statusCode: 422 },
    );
  }

  await tx.batchStock.update({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
    data: { onHand: { decrement: q } },
  });

  await adjustStock(tx, params.variantId, params.locationId, -q, 'so_fulfillment', movementOpts);
}

/** Put quantity back into a lot and aggregate level (e.g. revert fulfillment). */
export async function restoreVariantStockWithBatch(
  tx: TX,
  params: { variantId: string; locationId: string; qty: number; batchId: string },
  movementOpts: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(params.qty);
  if (q <= 0) return;

  const batch = await tx.batch.findFirst({
    where: { id: params.batchId, variantId: params.variantId },
  });
  if (!batch) return;

  await tx.batchStock.upsert({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
    create: { batchId: params.batchId, locationId: params.locationId, onHand: q, allocated: 0 },
    update: { onHand: { increment: q } },
  });

  await adjustStock(tx, params.variantId, params.locationId, q, 'so_fulfillment_reversal', movementOpts);
}

/** Increase warehouse `allocated` only (picked for SO, not yet shipped). Free pool = onHand - allocated. */
export async function allocatePickAtLevel(
  tx: TX,
  variantId: string,
  locationId: string,
  qty: number,
  opts?: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(qty);
  if (q <= 0) return;
  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
  const onHand = existing ? Number(existing.onHand) : 0;
  const allocated = existing ? Number(existing.allocated) : 0;
  const free = onHand - allocated;
  if (free < q) {
    const msg = existing
      ? `Cannot pick ${q} — only ${free} unallocated on hand at this location.`
      : 'No inventory level for this variant at the selected location.';
    throw Object.assign(new Error(msg), { statusCode: 422 });
  }
  await tx.inventoryLevel.update({
    where: { variantId_locationId: { variantId, locationId } },
    data: { allocated: { increment: q } },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId,
      locationId,
      qty: q,
      movementType: 'so_pick',
      referenceType: opts?.referenceType,
      referenceId: opts?.referenceId,
      note: opts?.note,
    },
  });
}

/** Ship quantity that was previously picked: decrement on-hand and allocated together. */
export async function shipPickedStockAtLevel(
  tx: TX,
  variantId: string,
  locationId: string,
  qty: number,
  opts?: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(qty);
  if (q <= 0) return;
  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
  if (!existing) {
    throw Object.assign(new Error('No inventory at this location.'), { statusCode: 422 });
  }
  const onHand = Number(existing.onHand);
  const allocated = Number(existing.allocated);
  if (allocated < q) {
    throw Object.assign(
      new Error(`Ship quantity exceeds picked (allocated) quantity at this location (${allocated} picked).`),
      { statusCode: 422 },
    );
  }
  if (onHand < q) {
    throw Object.assign(new Error('Insufficient on-hand to ship.'), { statusCode: 422 });
  }
  await tx.inventoryLevel.update({
    where: { variantId_locationId: { variantId, locationId } },
    data: { onHand: { decrement: q }, allocated: { decrement: q } },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId,
      locationId,
      qty: -q,
      movementType: 'so_fulfillment',
      referenceType: opts?.referenceType,
      referenceId: opts?.referenceId,
      note: opts?.note,
    },
  });
}

export async function allocatePickWithBatch(
  tx: TX,
  params: { variantId: string; locationId: string; qty: number; batchId: string },
  movementOpts: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(params.qty);
  if (q <= 0) return;

  const batch = await tx.batch.findFirst({
    where: { id: params.batchId, variantId: params.variantId },
  });
  if (!batch) {
    throw Object.assign(new Error('Selected lot does not belong to this product variant.'), { statusCode: 422 });
  }

  const bs = await tx.batchStock.findUnique({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
  });
  const bOn = bs ? Number(bs.onHand) : 0;
  const bAlloc = bs ? Number(bs.allocated) : 0;
  const bFree = bOn - bAlloc;
  if (bFree < q) {
    throw Object.assign(
      new Error(`Cannot pick ${q} from this lot — only ${bFree} unallocated in the lot at this location.`),
      { statusCode: 422 },
    );
  }

  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
  });
  const onHand = existing ? Number(existing.onHand) : 0;
  const allocated = existing ? Number(existing.allocated) : 0;
  const free = onHand - allocated;
  if (free < q) {
    throw Object.assign(
      new Error(`Cannot pick ${q} — only ${free} unallocated on hand at this location.`),
      { statusCode: 422 },
    );
  }

  await tx.batchStock.update({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
    data: { allocated: { increment: q } },
  });
  await tx.inventoryLevel.update({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
    data: { allocated: { increment: q } },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId: params.variantId,
      locationId: params.locationId,
      qty: q,
      movementType: 'so_pick',
      referenceType: movementOpts.referenceType,
      referenceId: movementOpts.referenceId,
      note: movementOpts.note,
    },
  });
}

export async function shipPickedStockWithBatch(
  tx: TX,
  params: { variantId: string; locationId: string; qty: number; batchId: string },
  movementOpts: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(params.qty);
  if (q <= 0) return;

  const batch = await tx.batch.findFirst({
    where: { id: params.batchId, variantId: params.variantId },
  });
  if (!batch) {
    throw Object.assign(new Error('Selected lot does not belong to this product variant.'), { statusCode: 422 });
  }

  const bs = await tx.batchStock.findUnique({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
  });
  const bAlloc = bs ? Number(bs.allocated) : 0;
  const bOn = bs ? Number(bs.onHand) : 0;
  if (bAlloc < q) {
    throw Object.assign(
      new Error(`Ship quantity exceeds picked quantity in this lot at this location (${bAlloc} picked).`),
      { statusCode: 422 },
    );
  }
  if (bOn < q) {
    throw Object.assign(new Error('Insufficient on-hand in the selected lot.'), { statusCode: 422 });
  }

  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
  });
  if (!existing) {
    throw Object.assign(new Error('No inventory at this location.'), { statusCode: 422 });
  }
  const lAlloc = Number(existing.allocated);
  const lOn = Number(existing.onHand);
  if (lAlloc < q || lOn < q) {
    throw Object.assign(new Error('Ship quantity exceeds picked stock at this location.'), { statusCode: 422 });
  }

  await tx.batchStock.update({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
    data: { onHand: { decrement: q }, allocated: { decrement: q } },
  });
  await tx.inventoryLevel.update({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
    data: { onHand: { decrement: q }, allocated: { decrement: q } },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId: params.variantId,
      locationId: params.locationId,
      qty: -q,
      movementType: 'so_fulfillment',
      referenceType: movementOpts.referenceType,
      referenceId: movementOpts.referenceId,
      note: movementOpts.note,
    },
  });
}

/** Undo a shipment that consumed picked + allocated stock (restores on-hand and allocation). */
export async function restoreShippedFromPickWithBatch(
  tx: TX,
  params: { variantId: string; locationId: string; qty: number; batchId: string },
  movementOpts: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(params.qty);
  if (q <= 0) return;

  const batch = await tx.batch.findFirst({
    where: { id: params.batchId, variantId: params.variantId },
  });
  if (!batch) return;

  await tx.batchStock.upsert({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
    create: { batchId: params.batchId, locationId: params.locationId, onHand: q, allocated: q },
    update: { onHand: { increment: q }, allocated: { increment: q } },
  });

  await tx.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
    create: { variantId: params.variantId, locationId: params.locationId, onHand: q, allocated: q },
    update: { onHand: { increment: q }, allocated: { increment: q } },
  });

  await tx.inventoryMovement.create({
    data: {
      variantId: params.variantId,
      locationId: params.locationId,
      qty: q,
      movementType: 'so_fulfillment_reversal',
      referenceType: movementOpts.referenceType,
      referenceId: movementOpts.referenceId,
      note: movementOpts.note,
    },
  });
}

/** Release a pick (decrement allocated only). */
export async function releasePickAtLevel(
  tx: TX,
  variantId: string,
  locationId: string,
  qty: number,
  opts?: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(qty);
  if (q <= 0) return;
  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
  const allocated = existing ? Number(existing.allocated) : 0;
  if (allocated < q) {
    throw Object.assign(new Error(`Cannot unpick ${q} — only ${allocated} allocated at this location.`), {
      statusCode: 422,
    });
  }
  await tx.inventoryLevel.update({
    where: { variantId_locationId: { variantId, locationId } },
    data: { allocated: { decrement: q } },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId,
      locationId,
      qty: -q,
      movementType: 'so_pick_release',
      referenceType: opts?.referenceType,
      referenceId: opts?.referenceId,
      note: opts?.note,
    },
  });
}

export async function releasePickWithBatch(
  tx: TX,
  params: { variantId: string; locationId: string; qty: number; batchId: string },
  movementOpts: { referenceType?: string; referenceId?: string; note?: string },
) {
  const q = Number(params.qty);
  if (q <= 0) return;

  const bs = await tx.batchStock.findUnique({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
  });
  const bAlloc = bs ? Number(bs.allocated) : 0;
  if (bAlloc < q) {
    throw Object.assign(new Error(`Cannot unpick ${q} from lot — only ${bAlloc} allocated.`), { statusCode: 422 });
  }

  const existing = await tx.inventoryLevel.findUnique({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
  });
  const lAlloc = existing ? Number(existing.allocated) : 0;
  if (lAlloc < q) {
    throw Object.assign(new Error(`Cannot unpick ${q} — only ${lAlloc} allocated at location.`), { statusCode: 422 });
  }

  await tx.batchStock.update({
    where: { batchId_locationId: { batchId: params.batchId, locationId: params.locationId } },
    data: { allocated: { decrement: q } },
  });
  await tx.inventoryLevel.update({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
    data: { allocated: { decrement: q } },
  });
  await tx.inventoryMovement.create({
    data: {
      variantId: params.variantId,
      locationId: params.locationId,
      qty: -q,
      movementType: 'so_pick_release',
      referenceType: movementOpts.referenceType,
      referenceId: movementOpts.referenceId,
      note: movementOpts.note,
    },
  });
}
