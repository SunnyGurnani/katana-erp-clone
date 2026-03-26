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
