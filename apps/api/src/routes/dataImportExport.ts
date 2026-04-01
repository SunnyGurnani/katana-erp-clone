import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Parser as Json2CsvParser } from 'json2csv';
import * as XLSX from 'xlsx';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type EntityType = 'products' | 'materials' | 'sales-orders' | 'purchase-orders' | 'inventory' | 'boms' | 'quotes' | 'stock-transfers';

const ENTITY_TYPES: EntityType[] = ['products', 'materials', 'sales-orders', 'purchase-orders', 'inventory', 'boms', 'quotes', 'stock-transfers'];

// ─── EXPORT ─────────────────────────────────────────────────────────────────

router.post('/export', async (req: AuthRequest, res: Response) => {
  const { entity, format, filters, ids } = z.object({
    entity: z.enum(['products', 'materials', 'sales-orders', 'purchase-orders', 'inventory', 'boms', 'quotes', 'stock-transfers']),
    format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
    filters: z.record(z.any()).optional(),
    ids: z.array(z.string()).optional(),
  }).parse(req.body);

  const idFilter = ids && ids.length > 0 ? { id: { in: ids } } : {};

  let data: any[];

  switch (entity) {
    case 'products':
      data = await prisma.product.findMany({ where: { ...idFilter, ...filters }, include: { variants: true } });
      data = data.map(p => ({
        id: p.id, name: p.name, sku: p.sku, description: p.description,
        category: p.category, salesPrice: p.salesPrice, purchasePrice: p.purchasePrice,
        isManufactured: p.isManufactured, isActive: p.isActive,
      }));
      break;
    case 'materials':
      data = await prisma.material.findMany({ where: { ...idFilter, ...filters } });
      data = data.map(m => ({
        id: m.id, name: m.name, sku: m.sku, description: m.description,
        category: m.category, purchasePrice: m.purchasePrice, unitOfMeasure: m.unitOfMeasure,
        isActive: m.isActive,
      }));
      break;
    case 'sales-orders':
      data = await prisma.salesOrder.findMany({ where: { ...idFilter, ...filters }, include: { rows: true, customer: { select: { name: true } } } });
      data = data.map(so => ({
        id: so.id, number: so.number, customer: (so as any).customer?.name,
        status: so.status, currency: so.currency,
        orderDate: so.orderDate, requiredDate: so.requiredDate,
        totalLines: so.rows.length,
      }));
      break;
    case 'purchase-orders':
      data = await prisma.purchaseOrder.findMany({ where: { ...idFilter, ...filters }, include: { rows: true, supplier: { select: { name: true } } } });
      data = data.map(po => ({
        id: po.id, number: po.number, supplier: (po as any).supplier?.name,
        status: po.status, currency: po.currency,
        expectedDate: po.expectedDate,
        totalLines: po.rows.length,
      }));
      break;
    case 'inventory':
      data = await prisma.inventoryLevel.findMany({
        where: filters || {},
        include: { variant: { include: { product: true } }, location: true },
      });
      data = data.map(l => ({
        variantId: l.variantId, product: (l as any).variant?.product?.name,
        variant: (l as any).variant?.name, sku: (l as any).variant?.sku,
        location: (l as any).location?.name,
        onHand: l.onHand, allocated: l.allocated,
        reorderPoint: l.reorderPoint, reorderQty: l.reorderQty,
      }));
      break;
    case 'boms':
      data = await prisma.bOM.findMany({ where: { ...idFilter, ...filters }, include: { rows: true, product: { select: { name: true } } } });
      data = data.map(b => ({
        id: b.id, name: b.name, product: (b as any).product?.name,
        qty: b.qty, isActive: b.isActive, totalRows: b.rows.length,
      }));
      break;
    case 'quotes':
      data = await prisma.quote.findMany({ where: { ...idFilter, ...filters }, include: { rows: true } });
      data = data.map(q => ({
        id: q.id, number: q.number, customerId: q.customerId,
        status: q.status, currency: q.currency, validUntil: q.validUntil,
        totalLines: q.rows.length,
      }));
      break;
    case 'stock-transfers':
      data = await prisma.stockTransfer.findMany({ where: { ...idFilter, ...filters } });
      data = data.map(st => ({
        id: st.id, variantId: st.variantId, fromLocationId: st.fromLocationId,
        toLocationId: st.toLocationId, qty: st.qty, status: st.status, note: st.note,
        createdAt: st.createdAt,
      }));
      break;
    default:
      return res.status(400).json({ error: `Unsupported entity: ${entity}` });
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}.json"`);
    return res.json(data);
  }

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, entity);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}.xlsx"`);
    return res.send(buf);
  }

  // CSV
  if (data.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
    return res.send('');
  }
  const parser = new Json2CsvParser();
  const csv = parser.parse(data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
  res.send(csv);
});

// ─── IMPORT ─────────────────────────────────────────────────────────────────

router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response) => {
  const { entity } = z.object({
    entity: z.enum(['products', 'materials', 'sales-orders', 'purchase-orders', 'inventory', 'boms']),
  }).parse(req.body);

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = req.file.buffer.toString('utf-8');
  let records: any[];

  if (req.file.originalname.endsWith('.json')) {
    records = JSON.parse(content);
  } else {
    records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  }

  let created = 0;
  let errors: string[] = [];

  switch (entity) {
    case 'products':
      for (const row of records) {
        try {
          await prisma.product.create({
            data: {
              name: row.name,
              sku: row.sku || undefined,
              description: row.description || undefined,
              category: row.category || undefined,
              salesPrice: row.salesPrice ? Number(row.salesPrice) : undefined,
              purchasePrice: row.purchasePrice ? Number(row.purchasePrice) : undefined,
              isManufactured: row.isManufactured === 'true' || row.isManufactured === true,
            },
          });
          created++;
        } catch (e: any) {
          errors.push(`Row ${created + errors.length + 1}: ${e.message}`);
        }
      }
      break;
    case 'materials':
      for (const row of records) {
        try {
          await prisma.material.create({
            data: {
              name: row.name,
              sku: row.sku || undefined,
              description: row.description || undefined,
              category: row.category || undefined,
              purchasePrice: row.purchasePrice ? Number(row.purchasePrice) : undefined,
              unitOfMeasure: row.unitOfMeasure || 'pcs',
            },
          });
          created++;
        } catch (e: any) {
          errors.push(`Row ${created + errors.length + 1}: ${e.message}`);
        }
      }
      break;
    case 'sales-orders':
      for (const row of records) {
        try {
          await prisma.salesOrder.create({
            data: {
              number: row.number,
              customerId: row.customerId || undefined,
              status: row.status || 'draft',
              currency: row.currency || 'USD',
              notes: row.notes || undefined,
            },
          });
          created++;
        } catch (e: any) {
          errors.push(`Row ${created + errors.length + 1}: ${e.message}`);
        }
      }
      break;
    case 'purchase-orders':
      for (const row of records) {
        try {
          await prisma.purchaseOrder.create({
            data: {
              number: row.number,
              supplierId: row.supplierId || undefined,
              status: row.status || 'draft',
              currency: row.currency || 'USD',
              notes: row.notes || undefined,
            },
          });
          created++;
        } catch (e: any) {
          errors.push(`Row ${created + errors.length + 1}: ${e.message}`);
        }
      }
      break;
    case 'inventory':
      for (const row of records) {
        try {
          if (!row.variantId || !row.locationId) {
            errors.push(`Row ${created + errors.length + 1}: variantId and locationId are required`);
            continue;
          }
          await prisma.inventoryLevel.upsert({
            where: { variantId_locationId: { variantId: row.variantId, locationId: row.locationId } },
            create: {
              variantId: row.variantId, locationId: row.locationId,
              onHand: Number(row.onHand) || 0, allocated: Number(row.allocated) || 0,
              reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : undefined,
            },
            update: {
              onHand: Number(row.onHand) || 0,
              allocated: Number(row.allocated) || 0,
              reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : undefined,
            },
          });
          created++;
        } catch (e: any) {
          errors.push(`Row ${created + errors.length + 1}: ${e.message}`);
        }
      }
      break;
    case 'boms':
      for (const row of records) {
        try {
          if (!row.productId) {
            errors.push(`Row ${created + errors.length + 1}: productId is required`);
            continue;
          }
          await prisma.bOM.create({
            data: {
              productId: row.productId,
              name: row.name || 'Default BOM',
              qty: row.qty ? Number(row.qty) : 1,
              notes: row.notes || undefined,
            },
          });
          created++;
        } catch (e: any) {
          errors.push(`Row ${created + errors.length + 1}: ${e.message}`);
        }
      }
      break;
  }

  res.json({ created, errors: errors.length, errorDetails: errors.slice(0, 50) });
});

// Available entity types
router.get('/entities', (_req, res) => {
  res.json(ENTITY_TYPES);
});

export default router;
