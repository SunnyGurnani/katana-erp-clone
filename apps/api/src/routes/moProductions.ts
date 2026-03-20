// MO Productions routes — appended to manufacturing router
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router({ mergeParams: true });

const prodSchema = z.object({
  qty: z.coerce.number().positive(),
  locationId: z.string().uuid().nullish(),
  status: z.string().default('planned'),
  producedAt: z.string().nullish(),
  notes: z.string().nullish(),
});

router.post('/orders/:id/productions', async (req, res) => {
  const data = prodSchema.parse(req.body);
  const mo = await prisma.manufacturingOrder.findUnique({
    where: { id: req.params.id },
    include: { recipeRows: true },
  });
  if (!mo) return res.status(404).json({ error: 'Not found' });

  const ratio = Number(mo.qtyPlanned) > 0 ? data.qty / Number(mo.qtyPlanned) : 0;

  const production = await prisma.mOProduction.create({
    data: {
      moId: req.params.id,
      qty: data.qty,
      locationId: data.locationId ?? undefined,
      status: data.status,
      producedAt: data.producedAt ? new Date(data.producedAt) : undefined,
      notes: data.notes ?? undefined,
      ingredients: {
        create: mo.recipeRows.map(rr => ({
          recipeRowId: rr.id,
          variantId: rr.variantId ?? undefined,
          materialId: rr.materialId ?? undefined,
          qtyRequired: Number(rr.qtyPlanned) * ratio,
          qtyConsumed: 0,
        })),
      },
    },
    include: { ingredients: true },
  });
  res.status(201).json(production);
});

router.get('/orders/:id/productions', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { moId: req.params.id };
  const [items, total] = await Promise.all([
    prisma.mOProduction.findMany({ where, include: { ingredients: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.mOProduction.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/productions/:id', async (req, res) => {
  const item = await prisma.mOProduction.findUnique({ where: { id: req.params.id }, include: { ingredients: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/productions/:id', async (req, res) => {
  const data = prodSchema.partial().parse(req.body);
  const updateData: any = { ...data };
  if (data.producedAt !== undefined) {
    updateData.producedAt = data.producedAt ? new Date(data.producedAt) : null;
  }
  const item = await prisma.mOProduction.update({
    where: { id: req.params.id },
    data: updateData,
    include: { ingredients: true },
  });
  res.json(item);
});

router.delete('/productions/:id', async (req, res) => {
  await prisma.mOProduction.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.patch('/productions/:id/ingredients/:ingredientId', async (req, res) => {
  const { qtyConsumed } = z.object({ qtyConsumed: z.coerce.number() }).parse(req.body);
  const item = await prisma.mOProductionIngredient.update({
    where: { id: req.params.ingredientId },
    data: { qtyConsumed },
  });
  res.json(item);
});

export default router;
