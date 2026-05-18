import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid().nullish(),
  qty: z.coerce.number(),
  forecastAt: z.string(),
  notes: z.string().nullish(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.variantId) where.variantId = req.query.variantId;
  if (req.query.locationId) where.locationId = req.query.locationId;
  const [items, total] = await Promise.all([
    prisma.demandForecast.findMany({ where, skip, take, orderBy: { forecastAt: 'asc' } }),
    prisma.demandForecast.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.use(requireOperatorForMutations);

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.demandForecast.create({
    data: { ...data, forecastAt: new Date(data.forecastAt) },
  });
  res.status(201).json(item);
});

router.delete('/', async (req, res) => {
  const { variantId, locationId } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid().nullish(),
  }).parse(req.query);
  const where: any = { variantId };
  if (locationId) where.locationId = locationId;
  await prisma.demandForecast.deleteMany({ where });
  res.status(204).send();
});

export default router;
