import { prisma } from './prisma';

/** Resolve BOM row unit cost from payload or linked material purchase price. */
export async function resolveBomRowUnitCost(
  materialId: string | null | undefined,
  unitCost: number | null | undefined,
): Promise<number | undefined> {
  if (unitCost != null && unitCost > 0) return unitCost;
  if (!materialId) return undefined;
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { purchasePrice: true },
  });
  if (material?.purchasePrice != null) return Number(material.purchasePrice);
  return undefined;
}
