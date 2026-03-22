import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// Parse events: accept string (CSV) or array
function parseEvents(events: any): string {
  if (Array.isArray(events)) return events.join(',');
  return String(events || '');
}

function webhookOut(wh: any) {
  return { ...wh, events: wh.events ? wh.events.split(',').filter(Boolean) : [] };
}

router.get('/', async (_req, res) => {
  const [items, total] = await Promise.all([prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } }), prisma.webhook.count()]);
  res.json(paginated(items.map(webhookOut), total, 1, 100));
});

router.post('/', async (req, res) => {
  const data = z.object({
    url: z.string().url(),
    name: z.string().optional().default(''),
    secret: z.string().nullish(),
    isActive: z.boolean().default(true),
    events: z.union([z.string(), z.array(z.string())]).optional().default(''),
  }).parse(req.body);
  const wh = await prisma.webhook.create({ data: { name: data.name, url: data.url, secret: data.secret ?? undefined, isActive: data.isActive, events: parseEvents(data.events) } });
  res.status(201).json(webhookOut(wh));
});

router.patch('/:id', async (req, res) => {
  const data = z.object({ name: z.string().nullish(), url: z.string().url().nullish(), isActive: z.boolean().nullish(), events: z.union([z.string(), z.array(z.string())]).nullish() }).parse(req.body);
  const update: any = {};
  if (data.name != null) update.name = data.name;
  if (data.url != null) update.url = data.url;
  if (data.isActive != null) update.isActive = data.isActive;
  if (data.events != null) update.events = parseEvents(data.events);
  const wh = await prisma.webhook.update({ where: { id: req.params.id }, data: update });
  res.json(webhookOut(wh));
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

// POST /webhooks/logs/export — export webhook logs as JSON array
router.post('/logs/export', async (req, res) => {
  const { webhookId, status, startDate, endDate } = (req.body || {}) as any;
  const where: any = {};
  if (webhookId) where.webhookId = webhookId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  const logs = await prisma.webhookLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000 });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="webhook_logs.json"');
  res.json(logs);
});

export default router;
