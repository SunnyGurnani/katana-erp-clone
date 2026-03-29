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
