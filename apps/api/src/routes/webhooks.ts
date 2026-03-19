import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const [items, total] = await Promise.all([prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } }), prisma.webhook.count()]);
  res.json(paginated(items, total, 1, 100));
});

router.post('/', async (req, res) => {
  const data = z.object({ name: z.string(), url: z.string().url(), secret: z.string().nullish(), isActive: z.boolean().default(true), events: z.string() }).parse(req.body);
  const wh = await prisma.webhook.create({ data: { ...data, secret: data.secret ?? undefined } });
  res.status(201).json(wh);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({ name: z.string().nullish(), url: z.string().url().nullish(), isActive: z.boolean().nullish(), events: z.string().nullish() }).parse(req.body);
  const whData: any = Object.fromEntries(Object.entries(data).filter(([,v]) => v != null));
  const wh = await prisma.webhook.update({ where: { id: req.params.id }, data: whData });
  res.json(wh);
});

router.delete('/:id', async (req, res) => {
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.get('/logs', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.webhookLog.findMany({ skip, take, orderBy: { createdAt: 'desc' } }), prisma.webhookLog.count()]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
