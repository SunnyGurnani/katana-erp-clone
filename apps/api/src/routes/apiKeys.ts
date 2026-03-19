import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateApiKey } from '../lib/jwt';
import { createHash } from 'crypto';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

router.get('/', async (req: AuthRequest, res) => {
  const keys = await prisma.apiKey.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true } });
  res.json(keys);
});

router.post('/', async (req: AuthRequest, res) => {
  const { name, scopes } = z.object({ name: z.string(), scopes: z.string().optional() }).parse(req.body) as { name: string; scopes?: string };
  const plaintext = generateApiKey();
  const key = await prisma.apiKey.create({
    data: { name, keyHash: hashKey(plaintext), keyPrefix: plaintext.slice(0, 12), isActive: true, userId: req.userId!, scopes: scopes },
  });
  res.status(201).json({ id: key.id, name: key.name, keyPrefix: key.keyPrefix, isActive: key.isActive, createdAt: key.createdAt, key: plaintext });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.apiKey.update({ where: { id: String(req.params.id), userId: req.userId! }, data: { isActive: false } });
  res.status(204).send();
});

export default router;
