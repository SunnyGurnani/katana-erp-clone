import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  poId: z.string().uuid(),
  materialId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  qtyRequired: z.coerce.number().positive(),
  qtyConsumed: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

// GET /outsourced_purchase_order_recipe_rows
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { poId } = req.query as Record<string, string>;
  const where: any = {};
  if (poId) where.poId = poId;
  const [items, total] = await Promise.all([
    prisma.outsourcedPORecipeRow.findMany({ where, include: { po: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.outsourcedPORecipeRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /outsourced_purchase_order_recipe_rows
router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.outsourcedPORecipeRow.create({ data });
  res.status(201).json(item);
});

// GET /outsourced_purchase_order_recipe_rows/:id
router.get('/:id', async (req, res) => {
  const item = await prisma.outsourcedPORecipeRow.findUnique({ where: { id: req.params.id }, include: { po: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// PATCH /outsourced_purchase_order_recipe_rows/:id
router.patch('/:id', async (req, res) => {
  const data = schema.partial().omit({ poId: true }).parse(req.body);
  const item = await prisma.outsourcedPORecipeRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

// DELETE /outsourced_purchase_order_recipe_rows/:id
router.delete('/:id', async (req, res) => {
  await prisma.outsourcedPORecipeRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
