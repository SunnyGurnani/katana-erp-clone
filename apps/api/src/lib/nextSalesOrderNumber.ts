import { prisma } from './prisma';

/**
 * Next SO-{year}-{seq} that does not collide with existing rows.
 * Uses max numeric suffix for the current year — not row count — so deletes/gaps do not cause unique violations.
 */
export async function nextSalesOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const orders = await prisma.salesOrder.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  let maxSeq = 0;
  const re = new RegExp(`^SO-${year}-(\\d+)$`, 'i');
  for (const o of orders) {
    const m = o.number.match(re);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}
