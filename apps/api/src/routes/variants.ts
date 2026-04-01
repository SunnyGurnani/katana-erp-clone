/**
 * Variants: SKU variants per product, inventory levels, and storage bin links.
 * @openapi
 * tags:
 *   - name: Variants
 *     description: Product variants and bin placement
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

const variantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().default('Default'),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  salesPrice: z.coerce.number().nullish(),
  purchasePrice: z.coerce.number().nullish(),
  isActive: z.boolean().default(true),
});

/**
 * @openapi
 * /variants:
 *   get:
 *     summary: List variants (paginated, optional productId or name search)
 *     tags: [Variants]
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated variants with product summary
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
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.productId) where.productId = req.query.productId;
  if (req.query.search) where.name = { contains: req.query.search as string };
  const [items, total] = await Promise.all([
    prisma.variant.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { product: { select: { id: true, name: true } } } }),
    prisma.variant.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

/**
 * @openapi
 * /variants:
 *   post:
 *     summary: Create a variant under a product
 *     tags: [Variants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               name: { type: string, default: Default }
 *               sku: { type: string, nullable: true }
 *               barcode: { type: string, nullable: true }
 *               salesPrice: { type: number, nullable: true }
 *               purchasePrice: { type: number, nullable: true }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       '201':
 *         description: Created variant with product summary
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/', async (req, res) => {
  const data = variantSchema.parse(req.body);
  const item = await prisma.variant.create({
    data: {
      productId: data.productId,
      name: data.name,
      sku: data.sku ?? undefined,
      barcode: data.barcode ?? undefined,
      salesPrice: data.salesPrice ?? undefined,
      purchasePrice: data.purchasePrice ?? undefined,
      isActive: data.isActive,
    },
    include: { product: { select: { id: true, name: true } } },
  });
  res.status(201).json(item);
});

/**
 * @openapi
 * /variants/{id}:
 *   get:
 *     summary: Get a variant by id (includes inventory levels)
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Variant with product and inventoryLevels
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
  const item = await prisma.variant.findUnique({
    where: { id: req.params.id },
    include: { product: { select: { id: true, name: true } }, inventoryLevels: true },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

/**
 * @openapi
 * /variants/{id}:
 *   patch:
 *     summary: Partially update a variant
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: string, format: uuid }
 *               name: { type: string }
 *               sku: { type: string, nullable: true }
 *               barcode: { type: string, nullable: true }
 *               salesPrice: { type: number, nullable: true }
 *               purchasePrice: { type: number, nullable: true }
 *               isActive: { type: boolean }
 *     responses:
 *       '200':
 *         description: Updated variant
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/:id', async (req, res) => {
  const data = variantSchema.partial().parse(req.body);
  const item = await prisma.variant.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku ?? undefined,
      barcode: data.barcode ?? undefined,
      salesPrice: data.salesPrice ?? undefined,
      purchasePrice: data.purchasePrice ?? undefined,
      isActive: data.isActive,
    },
    include: { product: { select: { id: true, name: true } } },
  });
  res.json(item);
});

/**
 * @openapi
 * /variants/{id}:
 *   delete:
 *     summary: Delete a variant
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 */
router.delete('/:id', async (req, res) => {
  await prisma.variant.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Storage Bins ─────────────────────────────────────────────────────────────

// GET variant's storage bins
/**
 * @openapi
 * /variants/{id}/storage-bins:
 *   get:
 *     summary: List storage bin links for a variant
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Variant bin locations with storage bin and location
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 */
router.get('/:id/storage-bins', async (req, res) => {
  const bins = await prisma.variantBinLocation.findMany({
    where: { variantId: req.params.id },
    include: { storageBin: { include: { location: true } } },
  });
  res.json(bins);
});

// Link variant to storage bin
/**
 * @openapi
 * /variants/{id}/storage-bins:
 *   post:
 *     summary: Link a variant to a storage bin (optionally as primary)
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storageBinId]
 *             properties:
 *               storageBinId: { type: string, format: uuid }
 *               isPrimary: { type: boolean, default: false }
 *     responses:
 *       '201':
 *         description: Created bin link
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/:id/storage-bins', async (req, res) => {
  const { storageBinId, isPrimary } = z.object({
    storageBinId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  }).parse(req.body);

  if (isPrimary) {
    await prisma.variantBinLocation.updateMany({
      where: { variantId: req.params.id },
      data: { isPrimary: false },
    });
  }

  const link = await prisma.variantBinLocation.create({
    data: { variantId: req.params.id, storageBinId, isPrimary },
    include: { storageBin: { include: { location: true } } },
  });
  res.status(201).json(link);
});

// Unlink variant from storage bin
/**
 * @openapi
 * /variants/{id}/storage-bins/{binLinkId}:
 *   delete:
 *     summary: Remove a variant–storage-bin link
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: binLinkId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 */
router.delete('/:id/storage-bins/:binLinkId', async (req, res) => {
  await prisma.variantBinLocation.delete({ where: { id: req.params.binLinkId } });
  res.status(204).send();
});

export default router;
