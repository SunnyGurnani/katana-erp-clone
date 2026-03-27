import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const snSchema = z.object({
  variantId: z.string().uuid(),
  serialNumber: z.string(),
  status: z.enum(['available', 'sold', 'returned', 'scrapped', 'reserved']).default('available'),
  notes: z.string().optional(),
});

// GET /serial_numbers
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { variantId, status } = req.query as Record<string, string>;
  const where: any = {};
  if (variantId) where.variantId = variantId;
  if (status) where.status = status;
  const [items, total] = await Promise.all([
    prisma.serialNumber.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.serialNumber.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /serial_numbers
router.post('/', async (req, res) => {
  const body = req.body;
  // Support bulk creation: {variantId, serialNumbers: string[]} or single {variantId, serialNumber}
  if (Array.isArray(body.serialNumbers)) {
    const { variantId, status = 'available', notes } = snSchema.partial().parse(body);
    if (!variantId) return res.status(400).json({ error: 'variantId required' });
    const items = await prisma.$transaction(
      body.serialNumbers.map((sn: string) =>
        prisma.serialNumber.create({ data: { variantId, serialNumber: sn, status: status!, notes } }),
      ),
    );
    return res.status(201).json(items);
  }
  const data = snSchema.parse(body);
  const item = await prisma.serialNumber.create({ data });
  res.status(201).json(item);
});

// GET /serial_numbers/:id
router.get('/:id', async (req, res) => {
  const item = await prisma.serialNumber.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// PATCH /serial_numbers/:id
router.patch('/:id', async (req, res) => {
  const data = snSchema.partial().parse(req.body);
  const item = await prisma.serialNumber.update({ where: { id: req.params.id }, data });
  res.json(item);
});

// DELETE /serial_numbers/:id or bulk by variantId
router.delete('/', async (req, res) => {
  const { variantId, status } = req.query as Record<string, string>;
  if (!variantId) return res.status(400).json({ error: 'variantId query param required for bulk delete' });
  const where: any = { variantId };
  if (status) where.status = status;
  const result = await prisma.serialNumber.deleteMany({ where });
  res.json({ deleted: result.count });
});

router.delete('/:id', async (req, res) => {
  await prisma.serialNumber.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// GET /serial_numbers/stock — stock summary per variant
router.get('/stock/summary', async (req, res) => {
  const { variantId } = req.query as Record<string, string>;
  const where: any = {};
  if (variantId) where.variantId = variantId;

  const groupResult = await prisma.serialNumber.groupBy({
    by: ['variantId', 'status'],
    where,
    _count: { id: true },
  });

  // Pivot by variantId
  const summary: Record<string, any> = {};
  for (const row of groupResult) {
    if (!summary[row.variantId]) summary[row.variantId] = { variantId: row.variantId, available: 0, sold: 0, returned: 0, scrapped: 0, reserved: 0, total: 0 };
    summary[row.variantId][row.status] = row._count.id;
    summary[row.variantId].total += row._count.id;
  }

  res.json(Object.values(summary));
});

export default router;
