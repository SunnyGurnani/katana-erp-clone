import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

router.post('/link', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid(),
    storageBinId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  }).parse(req.body);
  const item = await prisma.variantBinLocation.create({ data });
  res.status(201).json(item);
});

router.post('/unlink', async (req, res) => {
  const { variantId, storageBinId } = z.object({
    variantId: z.string().uuid(),
    storageBinId: z.string().uuid(),
  }).parse(req.body);
  await prisma.variantBinLocation.delete({
    where: { variantId_storageBinId: { variantId, storageBinId } },
  });
  res.status(204).send();
});

export default router;
