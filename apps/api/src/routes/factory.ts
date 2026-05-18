import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireAdminForMutations } from '../middleware/roles';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireAdminForMutations);

const schema = z.object({
  name: z.string().default('My Factory'),
  currency: z.string().default('USD'),
  timezone: z.string().default('UTC'),
  address: z.string().nullish(),
  logoUrl: z.string().nullish(),
  workingHoursStart: z.string().nullish(),
  workingHoursEnd: z.string().nullish(),
  workingDays: z.string().nullish(),
  defaultLocationId: z.string().nullish(),
});

async function upsertFactory(data: any) {
  let factory = await prisma.factory.findFirst();
  if (!factory) {
    factory = await prisma.factory.create({ data: { name: 'My Factory', ...data } });
  } else {
    factory = await prisma.factory.update({ where: { id: factory.id }, data });
  }
  return factory;
}

router.get('/', async (_req, res) => {
  let factory = await prisma.factory.findFirst();
  if (!factory) {
    factory = await prisma.factory.create({ data: { name: 'My Factory' } });
  }
  res.json(factory);
});

router.patch('/', async (req, res) => {
  const data = schema.partial().parse(req.body);
  res.json(await upsertFactory(data));
});

router.put('/', async (req, res) => {
  const data = schema.partial().parse(req.body);
  res.json(await upsertFactory(data));
});

export default router;
