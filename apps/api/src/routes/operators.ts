import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

// GET /operators — users with operator role (or all active users if no "operator" role exists)
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const operatorRole = await prisma.role.findUnique({ where: { name: 'operator' } });

  const where: any = { isActive: true };
  if (operatorRole) {
    where.roleId = operatorRole.id;
  }
  if (req.query.search) {
    where.OR = [
      { fullName: { contains: req.query.search as string, mode: 'insensitive' } },
      { email: { contains: req.query.search as string, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take, orderBy: { fullName: 'asc' },
      select: { id: true, email: true, fullName: true, isActive: true, roleId: true, role: { select: { name: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
