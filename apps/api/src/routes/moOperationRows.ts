import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    moId: z.string().uuid(),
    operationId: z.string().uuid().nullish(),
    name: z.string(),
    status: z.string().default('pending'),
    assignedToId: z.string().uuid().nullish(),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.mOOperationRow.create({ 
    data,
    include: { assignedTo: { select: { id: true, fullName: true, email: true } } }
  });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.moId) where.moId = req.query.moId;
  if (req.query.assignedToId) where.assignedToId = req.query.assignedToId;
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.mOOperationRow.findMany({ 
      where, 
      skip, 
      take, 
      orderBy: { createdAt: 'desc' },
      include: { 
        assignedTo: { select: { id: true, fullName: true, email: true } },
        mo: { select: { id: true, number: true, product: { select: { name: true } } } }
      }
    }),
    prisma.mOOperationRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.mOOperationRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    name: z.string().optional(),
    status: z.string().optional(),
    actualMinutes: z.coerce.number().nullish(),
    assignedToId: z.string().uuid().nullish(),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.mOOperationRow.update({ 
    where: { id: req.params.id }, 
    data,
    include: { assignedTo: { select: { id: true, fullName: true, email: true } } }
  });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.mOOperationRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /:id/assign — assign task to operator
router.post('/:id/assign', async (req, res) => {
  const { assignedToId } = z.object({ assignedToId: z.string().uuid() }).parse(req.body);
  const item = await prisma.mOOperationRow.update({
    where: { id: req.params.id },
    data: { assignedToId, status: 'assigned' },
    include: { assignedTo: { select: { id: true, fullName: true, email: true } } }
  });
  res.json(item);
});

// POST /:id/start — start working on task
router.post('/:id/start', async (req, res) => {
  const item = await prisma.mOOperationRow.update({
    where: { id: req.params.id },
    data: { 
      status: 'in_progress', 
      startedAt: new Date() 
    },
    include: { assignedTo: { select: { id: true, fullName: true, email: true } } }
  });
  res.json(item);
});

// POST /:id/complete — complete task
router.post('/:id/complete', async (req, res) => {
  const { actualMinutes, notes } = z.object({
    actualMinutes: z.coerce.number().optional(),
    notes: z.string().optional(),
  }).parse(req.body);
  
  const item = await prisma.mOOperationRow.update({
    where: { id: req.params.id },
    data: { 
      status: 'completed', 
      completedAt: new Date(),
      actualMinutes,
      notes
    },
    include: { assignedTo: { select: { id: true, fullName: true, email: true } } }
  });
  res.json(item);
});

// GET /my-tasks — get tasks assigned to current user
router.get('/my-tasks', async (req: any, res) => {
  const userId = req.userId; // from auth middleware
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = { assignedToId: userId };
  if (req.query.status) where.status = req.query.status;
  
  const [items, total] = await Promise.all([
    prisma.mOOperationRow.findMany({ 
      where, 
      skip, 
      take, 
      orderBy: { createdAt: 'desc' },
      include: { 
        mo: { 
          select: { 
            id: true, 
            number: true, 
            status: true,
            product: { select: { name: true } } 
          } 
        }
      }
    }),
    prisma.mOOperationRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
