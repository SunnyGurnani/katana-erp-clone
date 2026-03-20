import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

// GET /users
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, fullName: true, isActive: true, isSuperuser: true, roleId: true, role: true, createdAt: true, updatedAt: true },
      skip, take, orderBy: { fullName: 'asc' },
    }),
    prisma.user.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// GET /users/me (user_info)
router.get('/me', async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, fullName: true, isActive: true, isSuperuser: true, roleId: true, role: true, createdAt: true, updatedAt: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// GET /users/:id
router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, fullName: true, isActive: true, isSuperuser: true, roleId: true, role: true, createdAt: true, updatedAt: true },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// GET /operators — users who are active (operators = non-admin users in Katana)
router.get('/operators/list', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, fullName: true, isActive: true, roleId: true, role: true },
      skip, take, orderBy: { fullName: 'asc' },
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
