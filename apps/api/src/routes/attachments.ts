import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const attachmentSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  type: z.string().nullish(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.entityId) where.entityId = req.query.entityId;
  const [items, total] = await Promise.all([
    prisma.attachment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.attachment.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = attachmentSchema.parse(req.body);
  const item = await prisma.attachment.create({ data });
  res.status(201).json(item);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = attachmentSchema.partial().parse(req.body);
  const item = await prisma.attachment.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.attachment.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
