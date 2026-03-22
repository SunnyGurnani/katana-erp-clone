import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(authenticate);

function sendPdf(res: Response, filename: string, builder: (doc: InstanceType<typeof PDFDocument>) => void) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  builder(doc);
  doc.end();
}

function pdfHeader(doc: InstanceType<typeof PDFDocument>, title: string, num: string) {
  doc.fontSize(20).text(title, { align: 'left' });
  doc.fontSize(12).text(num, { align: 'left' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
}

function tableRow(doc: InstanceType<typeof PDFDocument>, cols: { text: string; width: number }[], y: number) {
  let x = 50;
  for (const col of cols) {
    doc.text(col.text, x, y, { width: col.width, align: 'left' });
    x += col.width;
  }
}

// ─── Sales Order PDF ─────────────────────────────────────────────────────────

router.get('/sales-orders/:id', async (req: AuthRequest, res: Response) => {
  const so: any = await prisma.salesOrder.findUnique({
    where: { id: req.params.id as string },
    include: { customer: true, rows: true },
  });
  if (!so) return res.status(404).json({ error: 'Not found' });

  sendPdf(res, `SO-${so.number}.pdf`, (doc) => {
    pdfHeader(doc, 'Sales Order', so.number);

    doc.fontSize(10);
    doc.text(`Customer: ${so.customer?.name || 'N/A'}`);
    doc.text(`Status: ${so.status}`);
    doc.text(`Currency: ${so.currency}`);
    if (so.requiredDate) doc.text(`Required Date: ${so.requiredDate.toISOString().split('T')[0]}`);
    if (so.notes) doc.text(`Notes: ${so.notes}`);
    doc.moveDown();

    const cols = [
      { text: '#', width: 30 },
      { text: 'Description', width: 200 },
      { text: 'Qty Ordered', width: 80 },
      { text: 'Unit Price', width: 80 },
      { text: 'Total', width: 80 },
    ];
    doc.font('Helvetica-Bold');
    tableRow(doc, cols, doc.y);
    doc.moveDown(0.5);
    doc.font('Helvetica');

    let grandTotal = 0;
    so.rows.forEach((row: any, i: number) => {
      const qty = Number(row.qtyOrdered);
      const price = Number(row.unitPrice || 0);
      const total = qty * price;
      grandTotal += total;
      tableRow(doc, [
        { text: String(i + 1), width: 30 },
        { text: row.description || `Variant ${row.variantId || 'N/A'}`, width: 200 },
        { text: qty.toFixed(2), width: 80 },
        { text: price.toFixed(2), width: 80 },
        { text: total.toFixed(2), width: 80 },
      ], doc.y);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.font('Helvetica-Bold');
    doc.text(`Grand Total: ${so.currency} ${grandTotal.toFixed(2)}`, { align: 'right' });
  });
});

// ─── Purchase Order PDF ──────────────────────────────────────────────────────

router.get('/purchase-orders/:id', async (req: AuthRequest, res: Response) => {
  const po: any = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id as string },
    include: { supplier: true, rows: true },
  });
  if (!po) return res.status(404).json({ error: 'Not found' });

  sendPdf(res, `PO-${po.number}.pdf`, (doc) => {
    pdfHeader(doc, 'Purchase Order', po.number);

    doc.fontSize(10);
    doc.text(`Supplier: ${po.supplier?.name || 'N/A'}`);
    doc.text(`Status: ${po.status}`);
    doc.text(`Currency: ${po.currency}`);
    if (po.expectedDate) doc.text(`Expected Date: ${po.expectedDate.toISOString().split('T')[0]}`);
    if (po.notes) doc.text(`Notes: ${po.notes}`);
    doc.moveDown();

    const cols = [
      { text: '#', width: 30 },
      { text: 'Description', width: 200 },
      { text: 'Qty Ordered', width: 80 },
      { text: 'Unit Price', width: 80 },
      { text: 'Total', width: 80 },
    ];
    doc.font('Helvetica-Bold');
    tableRow(doc, cols, doc.y);
    doc.moveDown(0.5);
    doc.font('Helvetica');

    let grandTotal = 0;
    po.rows.forEach((row: any, i: number) => {
      const qty = Number(row.qtyOrdered);
      const price = Number(row.unitPrice || 0);
      const total = qty * price;
      grandTotal += total;
      tableRow(doc, [
        { text: String(i + 1), width: 30 },
        { text: row.description || `Item ${row.variantId || row.materialId || 'N/A'}`, width: 200 },
        { text: qty.toFixed(2), width: 80 },
        { text: price.toFixed(2), width: 80 },
        { text: total.toFixed(2), width: 80 },
      ], doc.y);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.font('Helvetica-Bold');
    doc.text(`Grand Total: ${po.currency} ${grandTotal.toFixed(2)}`, { align: 'right' });
  });
});

// ─── Manufacturing Order PDF ─────────────────────────────────────────────────

router.get('/manufacturing-orders/:id', async (req: AuthRequest, res: Response) => {
  const mo: any = await prisma.manufacturingOrder.findUnique({
    where: { id: req.params.id as string },
    include: { product: true, bom: true, recipeRows: true, operationRows: true },
  });
  if (!mo) return res.status(404).json({ error: 'Not found' });

  sendPdf(res, `MO-${mo.number}.pdf`, (doc) => {
    pdfHeader(doc, 'Manufacturing Order', mo.number);

    doc.fontSize(10);
    doc.text(`Product: ${mo.product?.name || 'N/A'}`);
    doc.text(`BOM: ${mo.bom?.name || 'N/A'}`);
    doc.text(`Status: ${mo.status}`);
    doc.text(`Qty Planned: ${Number(mo.qtyPlanned).toFixed(2)}`);
    doc.text(`Qty Produced: ${Number(mo.qtyProduced).toFixed(2)}`);
    if (mo.plannedStart) doc.text(`Planned Start: ${mo.plannedStart.toISOString().split('T')[0]}`);
    if (mo.plannedEnd) doc.text(`Planned End: ${mo.plannedEnd.toISOString().split('T')[0]}`);
    if (mo.notes) doc.text(`Notes: ${mo.notes}`);
    doc.moveDown();

    if (mo.recipeRows.length > 0) {
      doc.font('Helvetica-Bold').fontSize(12).text('Recipe Rows');
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.3);
      const cols = [
        { text: '#', width: 30 },
        { text: 'Material/Variant ID', width: 200 },
        { text: 'Qty Planned', width: 80 },
        { text: 'Qty Consumed', width: 80 },
      ];
      doc.font('Helvetica-Bold');
      tableRow(doc, cols, doc.y);
      doc.moveDown(0.5);
      doc.font('Helvetica');

      mo.recipeRows.forEach((row: any, i: number) => {
        tableRow(doc, [
          { text: String(i + 1), width: 30 },
          { text: row.materialId || row.variantId || 'N/A', width: 200 },
          { text: Number(row.qtyPlanned).toFixed(2), width: 80 },
          { text: Number(row.qtyConsumed).toFixed(2), width: 80 },
        ], doc.y);
        doc.moveDown(0.5);
      });
      doc.moveDown();
    }

    if (mo.operationRows.length > 0) {
      doc.font('Helvetica-Bold').fontSize(12).text('Operations');
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.3);
      const cols = [
        { text: '#', width: 30 },
        { text: 'Name', width: 200 },
        { text: 'Status', width: 100 },
        { text: 'Actual Min', width: 80 },
      ];
      doc.font('Helvetica-Bold');
      tableRow(doc, cols, doc.y);
      doc.moveDown(0.5);
      doc.font('Helvetica');

      mo.operationRows.forEach((row: any, i: number) => {
        tableRow(doc, [
          { text: String(i + 1), width: 30 },
          { text: row.name, width: 200 },
          { text: row.status, width: 100 },
          { text: row.actualMinutes != null ? String(row.actualMinutes) : 'N/A', width: 80 },
        ], doc.y);
        doc.moveDown(0.5);
      });
    }
  });
});

export default router;
