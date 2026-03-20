import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().default('My Factory'),
  currency: z.string().default('USD'),
  timezone: z.string().default('UTC'),
  address: z.string().nullish(),
  logoUrl: z.string().nullish(),
});

router.get('/', async (_req, res) => {
  let factory = await prisma.factory.findFirst();
  if (!factory) {
    factory = await prisma.factory.create({ data: { name: 'My Factory' } });
  }
  res.json(factory);
});

router.patch('/', async (req, res) => {
  const data = schema.partial().parse(req.body);
  let factory = await prisma.factory.findFirst();
  if (!factory) {
    factory = await prisma.factory.create({ data: { name: 'My Factory', ...data } });
  } else {
    factory = await prisma.factory.update({ where: { id: factory.id }, data });
  }
  res.json(factory);
});

export default router;
