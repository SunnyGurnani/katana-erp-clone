import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { signToken, verifyToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });
  res.json({ accessToken: signToken(user.id, 'access'), refreshToken: signToken(user.id, 'refresh'), tokenType: 'bearer' });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found' });
    res.json({ accessToken: signToken(user.id, 'access'), refreshToken: signToken(user.id, 'refresh'), tokenType: 'bearer' });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, fullName: true, isActive: true, isSuperuser: true, createdAt: true } });
  res.json(user);
});

router.post('/register', async (req, res) => {
  const data = z.object({ email: z.string().email(), fullName: z.string(), password: z.string().min(8), isSuperuser: z.boolean().default(false) }).parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return res.status(400).json({ error: 'Email already registered' });
  const user = await prisma.user.create({ data: { email: data.email, fullName: data.fullName, hashedPassword: await hashPassword(data.password), isSuperuser: data.isSuperuser } });
  res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, isActive: user.isActive, isSuperuser: user.isSuperuser });
});

export default router;
