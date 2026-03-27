/**
 * Inventory: stock levels, movements, negative stock, and reorder settings.
 * @openapi
 * tags:
 *   - name: Inventory
 *     description: On-hand levels, movements, and reorder configuration
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

/**
 * @openapi
 * /inventory/levels:
 *   get:
 *     summary: List inventory levels (paginated)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         description: Page size (alias limit)
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *       - in: query
 *         name: locationId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: variantId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Paginated inventory levels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { type: object }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/levels', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.locationId) where.locationId = req.query.locationId;
  if (req.query.variantId) where.variantId = req.query.variantId;
  const [items, total] = await Promise.all([prisma.inventoryLevel.findMany({ where, skip, take }), prisma.inventoryLevel.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

/**
 * @openapi
 * /inventory/movements:
 *   get:
 *     summary: List inventory movements (paginated, newest first)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *       - in: query
 *         name: variantId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: locationId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Paginated movements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/movements', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.variantId) where.variantId = req.query.variantId;
  if (req.query.locationId) where.locationId = req.query.locationId;
  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryMovement.count({ where })
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /inventory/reorder_points — set reorder point for a variant+location
/**
 * @openapi
 * /inventory/reorder-points:
 *   post:
 *     summary: Set or update reorder point for a variant at a location
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [variantId, locationId, reorderPoint]
 *             properties:
 *               variantId: { type: string, format: uuid }
 *               locationId: { type: string, format: uuid }
 *               reorderPoint: { type: number, minimum: 0 }
 *     responses:
 *       '200':
 *         description: Upserted inventory level
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/reorder-points', async (req, res) => {
  const { variantId, locationId, reorderPoint } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    reorderPoint: z.coerce.number().min(0),
  }).parse(req.body);

  const item = await prisma.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, reorderPoint, onHand: 0, allocated: 0 },
    update: { reorderPoint },
  });
  res.json(item);
});

// POST /inventory/safety_stock_levels — set reorder qty (safety stock) for a variant+location
/**
 * @openapi
 * /inventory/safety-stock:
 *   post:
 *     summary: Set or update safety stock (reorder quantity) for a variant at a location
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [variantId, locationId, reorderQty]
 *             properties:
 *               variantId: { type: string, format: uuid }
 *               locationId: { type: string, format: uuid }
 *               reorderQty: { type: number, minimum: 0 }
 *     responses:
 *       '200':
 *         description: Upserted inventory level
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/safety-stock', async (req, res) => {
  const { variantId, locationId, reorderQty } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    reorderQty: z.coerce.number().min(0),
  }).parse(req.body);

  const item = await prisma.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, reorderQty, onHand: 0, allocated: 0 },
    update: { reorderQty },
  });
  res.json(item);
});

// GET /inventory/negative_stock — variants with onHand < 0
/**
 * @openapi
 * /inventory/negative-stock:
 *   get:
 *     summary: List inventory levels with negative on-hand (paginated)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated levels including variant, product, and location
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/negative-stock', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { onHand: { lt: 0 } };
  const [items, total] = await Promise.all([
    prisma.inventoryLevel.findMany({ where, include: { variant: { include: { product: true } }, location: true }, skip, take, orderBy: { onHand: 'asc' } }),
    prisma.inventoryLevel.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
