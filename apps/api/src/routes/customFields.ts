import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const ENTITY_TYPES = [
  'product', 'variant', 'material', 'supplier', 'customer',
  'purchase_order', 'sales_order', 'manufacturing_order',
] as const;

const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'select', 'multiselect', 'url'] as const;

const defSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  name: z.string().regex(/^[a-z0-9_]+$/, 'name must be snake_case'),
  label: z.string(),
  fieldType: z.enum(FIELD_TYPES),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
  defaultValue: z.string().optional(),
  rank: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// ── Definitions ─────────────────────────────────────────────────────────────

// GET /custom-fields?entityType=product
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const entityType = req.query.entityType as string | undefined;
  const where: any = {};
  if (entityType) where.entityType = entityType;
  const [items, total] = await Promise.all([
    prisma.customFieldDefinition.findMany({ where, skip, take, orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }] }),
    prisma.customFieldDefinition.count({ where }),
  ]);
  res.json(paginated(items.map((d: any) => ({
    ...d,
    options: d.options ? JSON.parse(d.options) : null,
  })), total, page, pageSize));
});

// POST /custom-fields
router.post('/', async (req, res) => {
  const data = defSchema.parse(req.body);
  const item = await prisma.customFieldDefinition.create({
    data: {
      ...data,
      options: data.options ? JSON.stringify(data.options) : null,
    },
  });
  res.status(201).json({ ...item, options: item.options ? JSON.parse(item.options) : null });
});

// PATCH /custom-fields/:id
router.patch('/:id', async (req, res) => {
  const data = defSchema.partial().parse(req.body);
  const item = await prisma.customFieldDefinition.update({
    where: { id: req.params.id },
    data: {
      ...data,
      options: data.options !== undefined ? JSON.stringify(data.options) : undefined,
    },
  });
  res.json({ ...item, options: item.options ? JSON.parse(item.options) : null });
});

// DELETE /custom-fields/:id
router.delete('/:id', async (req, res) => {
  await prisma.customFieldDefinition.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Values ───────────────────────────────────────────────────────────────────

// GET /custom-fields/values?entityType=product&entityId=xxx
router.get('/values', async (req, res) => {
  const { entityType, entityId } = z.object({
    entityType: z.string(),
    entityId: z.string().optional(),
  }).parse(req.query);

  const where: any = { entityType };
  if (entityId) where.entityId = entityId;

  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.customFieldValue.findMany({ where, skip, take, include: { field: true }, orderBy: { createdAt: 'asc' } }),
    prisma.customFieldValue.count({ where }),
  ]);

  // Cast values based on fieldType
  const parsed = items.map((v: any) => ({
    ...v,
    parsedValue: castValue(v.value, v.field.fieldType),
  }));

  res.json(paginated(parsed, total, page, pageSize));
});

// POST /custom-fields/values — upsert
router.post('/values', async (req, res) => {
  const data = z.object({
    fieldId: z.string().uuid(),
    entityType: z.string(),
    entityId: z.string(),
    value: z.string().nullish(),
  }).parse(req.body);

  // Validate field exists
  const field = await prisma.customFieldDefinition.findUnique({ where: { id: data.fieldId } });
  if (!field) return res.status(404).json({ error: 'Custom field definition not found' });
  if (!field.isActive) return res.status(400).json({ error: 'Custom field is inactive' });
  if (field.isRequired && (data.value === null || data.value === undefined || data.value === '')) {
    return res.status(400).json({ error: `Field "${field.label}" is required` });
  }

  const item = await prisma.customFieldValue.upsert({
    where: { fieldId_entityId: { fieldId: data.fieldId, entityId: data.entityId } },
    create: { fieldId: data.fieldId, entityType: data.entityType, entityId: data.entityId, value: data.value ?? null },
    update: { value: data.value ?? null, updatedAt: new Date() },
    include: { field: true },
  });

  res.status(201).json({ ...item, parsedValue: castValue(item.value, item.field.fieldType) });
});

// DELETE /custom-fields/values/:id
router.delete('/values/:id', async (req, res) => {
  await prisma.customFieldValue.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Bulk helpers ──────────────────────────────────────────────────────────────

// GET /custom-fields/entity/:entityType/:entityId — all fields + values for one entity
router.get('/entity/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;
  const definitions = await prisma.customFieldDefinition.findMany({
    where: { entityType, isActive: true },
    orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
  });
  const values = await prisma.customFieldValue.findMany({ where: { entityType, entityId } });

  const valueMap = Object.fromEntries(values.map((v: any) => [v.fieldId, v.value]));
  const result = definitions.map((d: any) => ({
    ...d,
    options: d.options ? JSON.parse(d.options) : null,
    value: castValue(valueMap[d.id] ?? d.defaultValue ?? null, d.fieldType),
    rawValue: valueMap[d.id] ?? d.defaultValue ?? null,
    hasValue: d.id in valueMap,
  }));

  res.json(result);
});

// POST /custom-fields/entity/:entityType/:entityId — bulk upsert values
router.post('/entity/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;
  const { fields } = z.object({
    fields: z.array(z.object({ fieldId: z.string().uuid(), value: z.string().nullish() })),
  }).parse(req.body);

  const results: any[] = [];
  for (const f of fields) {
    const field = await prisma.customFieldDefinition.findUnique({ where: { id: f.fieldId } });
    if (!field) { results.push({ fieldId: f.fieldId, status: 'error', error: 'Field not found' }); continue; }

    const item = await prisma.customFieldValue.upsert({
      where: { fieldId_entityId: { fieldId: f.fieldId, entityId } },
      create: { fieldId: f.fieldId, entityType, entityId, value: f.value ?? null },
      update: { value: f.value ?? null, updatedAt: new Date() },
    });
    results.push({ fieldId: f.fieldId, id: item.id, status: 'ok', value: castValue(item.value, field.fieldType) });
  }

  res.json(results);
});

// ── Value casting ─────────────────────────────────────────────────────────────

export function castValue(raw: string | null | undefined, fieldType: string): any {
  if (raw === null || raw === undefined) return null;
  switch (fieldType) {
    case 'number': return isNaN(Number(raw)) ? null : Number(raw);
    case 'boolean': return raw === 'true' || raw === '1';
    case 'date': { const d = new Date(raw); return isNaN(d.getTime()) ? null : d.toISOString(); }
    case 'multiselect': try { return JSON.parse(raw); } catch { return [raw]; }
    default: return raw;
  }
}

// ── Enrich helper (used by middleware) ────────────────────────────────────────

export async function enrichWithCustomFields(entityType: string, entityId: string): Promise<Record<string, any>> {
  const values = await prisma.customFieldValue.findMany({
    where: { entityType, entityId },
    include: { field: true },
  });
  const result: Record<string, any> = {};
  for (const v of values) {
    result[v.field.name] = castValue(v.value, v.field.fieldType);
  }
  return result;
}

export default router;
