import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(authenticate);

async function lookupByIdentifier(identifier: string) {
  const variant = await prisma.variant.findFirst({
    where: { OR: [{ sku: identifier }, { id: identifier }, { barcode: identifier }] },
    include: { product: true },
  });
  if (variant) return { type: 'variant' as const, item: variant };

  const material = await prisma.material.findFirst({
    where: { OR: [{ sku: identifier }, { id: identifier }] },
  });
  if (material) return { type: 'material' as const, item: material };

  return null;
}

function formatParam(req: any) {
  return z.object({ format: z.enum(['code128', 'qr']).default('code128') }).parse(req.query).format;
}

async function genBarcodePng(text: string, format: 'code128' | 'qr') {
  return bwipjs.toBuffer({
    bcid: format === 'qr' ? 'qrcode' : 'code128',
    text,
    scale: 3,
    height: format === 'qr' ? 30 : 12,
    includetext: format !== 'qr',
    textxalign: 'center',
    backgroundcolor: 'FFFFFF',
  } as any);
}

async function sendBarcodePng(res: any, text: string, format: 'code128' | 'qr') {
  try {
    const png = await genBarcodePng(text, format);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${text}-${format}.png"`);
    res.send(png);
  } catch (err: any) {
    res.status(500).json({ error: 'Barcode generation failed', detail: err.message });
  }
}

async function sendLabelPdf(res: any, name: string, sku: string, format: 'code128' | 'qr', copies: number) {
  try {
    const barcodePng = await genBarcodePng(sku, format);
    const doc = new PDFDocument({ size: [144, 72], margin: 4 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sku}-label.pdf"`);
    doc.pipe(res);
    for (let i = 0; i < copies; i++) {
      if (i > 0) doc.addPage({ size: [144, 72], margin: 4 });
      doc.fontSize(6).font('Helvetica-Bold').text(name.substring(0, 28), 4, 4, { width: 136, align: 'center', ellipsis: true });
      doc.fontSize(5).font('Helvetica').text(`SKU: ${sku}`, 4, 13, { width: 136, align: 'center' });
      doc.image(barcodePng, 4, 22, { fit: [136, 44], align: 'center' });
    }
    doc.end();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: 'Label generation failed', detail: err.message });
  }
}

// GET /barcodes/variants/:id/barcode?format=code128|qr
router.get('/variants/:id/barcode', async (req, res) => {
  const format = formatParam(req);
  const variant = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!variant) return res.status(404).json({ error: 'Variant not found' });
  await sendBarcodePng(res, variant.sku || variant.id, format);
});

// GET /barcodes/variants/:id/barcode/svg
router.get('/variants/:id/barcode/svg', async (req, res) => {
  const format = formatParam(req);
  const variant = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!variant) return res.status(404).json({ error: 'Variant not found' });
  const text = variant.sku || variant.id;
  try {
    const svg = await bwipjs.toSVG({
      bcid: format === 'qr' ? 'qrcode' : 'code128',
      text,
      scale: 3,
      height: format === 'qr' ? 30 : 12,
      includetext: format !== 'qr',
      textxalign: 'center',
    } as any);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: 'SVG generation failed', detail: err.message });
  }
});

// GET /barcodes/variants/:id/label
router.get('/variants/:id/label', async (req, res) => {
  const { format, copies } = z.object({
    format: z.enum(['code128', 'qr']).default('code128'),
    copies: z.coerce.number().int().min(1).max(100).default(1),
  }).parse(req.query);

  const variant = await prisma.variant.findUnique({ where: { id: req.params.id }, include: { product: true } });
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  await sendLabelPdf(res, variant.product?.name || variant.name, variant.sku || variant.id, format, copies);
});

// GET /barcodes/materials/:id/barcode?format=code128|qr
router.get('/materials/:id/barcode', async (req, res) => {
  const format = formatParam(req);
  const material = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!material) return res.status(404).json({ error: 'Material not found' });
  await sendBarcodePng(res, material.sku || material.id, format);
});

// GET /barcodes/materials/:id/label
router.get('/materials/:id/label', async (req, res) => {
  const { format, copies } = z.object({
    format: z.enum(['code128', 'qr']).default('code128'),
    copies: z.coerce.number().int().min(1).max(100).default(1),
  }).parse(req.query);

  const material = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!material) return res.status(404).json({ error: 'Material not found' });

  await sendLabelPdf(res, material.name, material.sku || material.id, format, copies);
});

// POST /barcodes/scan — {barcode} → returns variant or material match + inventory
router.post('/scan', async (req, res) => {
  const { barcode } = z.object({ barcode: z.string().min(1) }).parse(req.body);

  const result = await lookupByIdentifier(barcode);
  if (!result) return res.status(404).json({ error: 'No item found for barcode', barcode });

  if (result.type === 'variant') {
    const variant = result.item as any;
    const inventory = await prisma.inventoryLevel.findMany({
      where: { variantId: variant.id },
      include: { location: true },
    });
    return res.json({
      type: 'variant',
      item: variant,
      inventory,
      totalStock: inventory.reduce((sum: number, l: any) => sum + Number(l.onHand), 0),
    });
  } else {
    const material = result.item as any;
    return res.json({
      type: 'material',
      item: material,
    });
  }
});

export default router;
