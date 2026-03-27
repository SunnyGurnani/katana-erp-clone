import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { signToken, verifyToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true, isActive: true } } },
        where: { tenant: { isActive: true } },
      },
    },
  });
  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

  // Find default tenant
  const defaultMembership = user.memberships.find((m: any) => m.isDefault) || user.memberships[0] || null;
  const tenants = user.memberships.map((m: any) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
    logoUrl: m.tenant.logoUrl,
    role: m.role,
    isDefault: m.isDefault,
  }));

  res.json({
    accessToken: signToken(user.id, 'access'),
    refreshToken: signToken(user.id, 'refresh'),
    tokenType: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperuser: user.isSuperuser,
    },
    tenants,
    currentTenantId: defaultMembership?.tenant.id || null,
  });
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
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, fullName: true, isActive: true, isSuperuser: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: req.userId, tenant: { isActive: true } },
    include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });

  const tenants = memberships.map((m: any) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
    logoUrl: m.tenant.logoUrl,
    role: m.role,
    isDefault: m.isDefault,
  }));

  res.json({ ...user, tenants });
});

router.post('/register', async (req, res) => {
  const data = z.object({
    email: z.string().email(),
    fullName: z.string(),
    password: z.string().min(8),
    isSuperuser: z.boolean().default(false),
    tenantName: z.string().min(1).optional(),
  }).parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return res.status(400).json({ error: 'Email already registered' });

  const user = await prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      hashedPassword: await hashPassword(data.password),
      isSuperuser: data.isSuperuser,
    },
  });

  let tenant = null;
  if (data.tenantName) {
    // Create a new tenant/company for this user
    const slug = data.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    // Make slug unique
    let uniqueSlug = slug;
    let attempt = 0;
    while (await prisma.tenant.findUnique({ where: { slug: uniqueSlug } })) {
      attempt++;
      uniqueSlug = `${slug}-${attempt}`;
    }

    tenant = await prisma.tenant.create({
      data: {
        name: data.tenantName,
        slug: uniqueSlug,
        memberships: {
          create: { userId: user.id, role: 'owner', isDefault: true },
        },
      },
    });
  }

  res.status(201).json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    isSuperuser: user.isSuperuser,
    tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
  });
});

// ─── Tenant management ────────────────────────────────────────────────────────

router.post('/tenants', authenticate, async (req: AuthRequest, res) => {
  const data = z.object({
    name: z.string().min(1),
  }).parse(req.body);

  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  let uniqueSlug = slug;
  let attempt = 0;
  while (await prisma.tenant.findUnique({ where: { slug: uniqueSlug } })) {
    attempt++;
    uniqueSlug = `${slug}-${attempt}`;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: uniqueSlug,
      memberships: {
        create: { userId: req.userId!, role: 'owner', isDefault: false },
      },
    },
  });

  res.status(201).json({ id: tenant.id, name: tenant.name, slug: tenant.slug });
});

router.get('/tenants', authenticate, async (req: AuthRequest, res) => {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: req.userId, tenant: { isActive: true } },
    include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });

  res.json(memberships.map((m: any) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
    logoUrl: m.tenant.logoUrl,
    role: m.role,
    isDefault: m.isDefault,
  })));
});

router.post('/tenants/:tenantId/switch', authenticate, async (req: AuthRequest, res) => {
  const tenantId = req.params.tenantId as string;

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: req.userId! } },
  });

  if (!membership) return res.status(403).json({ error: 'Not a member of this tenant' });

  // Reset all default flags, set this one as default
  await prisma.tenantMembership.updateMany({
    where: { userId: req.userId! },
    data: { isDefault: false },
  });
  await prisma.tenantMembership.update({
    where: { id: membership.id },
    data: { isDefault: true },
  });

  res.json({ currentTenantId: tenantId });
});

router.post('/tenants/:tenantId/invite', authenticate, async (req: AuthRequest, res) => {
  const tenantId = req.params.tenantId as string;
  const data = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member', 'viewer']).default('member'),
  }).parse(req.body);

  // Verify requester is owner/admin of this tenant
  const requesterMembership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: req.userId! } },
  });
  if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
    return res.status(403).json({ error: 'Only owners and admins can invite members' });
  }

  const invitee = await prisma.user.findUnique({ where: { email: data.email } });
  if (!invitee) return res.status(404).json({ error: 'User not found. They must register first.' });

  const existing = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: invitee.id } },
  });
  if (existing) return res.status(400).json({ error: 'User is already a member' });

  const membership = await prisma.tenantMembership.create({
    data: { tenantId, userId: invitee.id, role: data.role },
  });

  res.status(201).json({ id: membership.id, userId: invitee.id, role: membership.role });
});

export default router;
