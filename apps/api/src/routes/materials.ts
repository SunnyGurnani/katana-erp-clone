/**
 * Materials: raw material master data (CRUD).
 * @openapi
 * tags:
 *   - name: Materials
 *     description: Purchased components and raw materials
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string(),
  sku: z.string().nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  unitOfMeasure: z.string().default('pcs'),
  isActive: z.boolean().default(true),
  purchasePrice: z.coerce.number().nullish(),
  reorderPoint: z.coerce.number().nullish(),
  leadTimeDays: z.number().int().nullish(),
});

/**
 * @openapi
 * /materials:
 *   get:
 *     summary: List materials (paginated, optional name search)
 *     tags: [Materials]
 *     parameters:
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
 *         description: Paginated materials
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
  const where = req.query.search ? { name: { contains: req.query.search as string } } : {};
  const [items, total] = await Promise.all([prisma.material.findMany({ where, skip, take, orderBy: { name: 'asc' } }), prisma.material.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

/**
 * @openapi
 * /materials:
 *   post:
 *     summary: Create a material
 *     tags: [Materials]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               sku: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               unitOfMeasure: { type: string, default: pcs }
 *               isActive: { type: boolean, default: true }
 *               purchasePrice: { type: number, nullable: true }
 *               reorderPoint: { type: number, nullable: true }
 *               leadTimeDays: { type: integer, nullable: true }
 *     responses:
 *       '201':
 *         description: Created material
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const m = await prisma.material.create({ data: { ...data, sku: data.sku ?? undefined } });
  res.status(201).json(m);
});

/**
 * @openapi
 * /materials/{id}:
 *   get:
 *     summary: Get a material by id
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Material
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
  const m = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json(m);
});

/**
 * @openapi
 * /materials/{id}:
 *   patch:
 *     summary: Partially update a material
 *     tags: [Materials]
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
 *               name: { type: string }
 *               sku: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               unitOfMeasure: { type: string }
 *               isActive: { type: boolean }
 *               purchasePrice: { type: number, nullable: true }
 *               reorderPoint: { type: number, nullable: true }
 *               leadTimeDays: { type: integer, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated material
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const m = await prisma.material.update({ where: { id: req.params.id }, data });
  res.json(m);
});

/**
 * @openapi
 * /materials/{id}:
 *   delete:
 *     summary: Delete a material
 *     tags: [Materials]
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
  await prisma.material.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
