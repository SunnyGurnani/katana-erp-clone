import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { adjustStock } from '../src/lib/inventory';
import {
  cleanupInventoryIntegrationTest,
  seedInventoryIntegrationTest,
  type InventoryTestContext,
} from './helpers/testDb';

const v1 = '/api/v1';

describe('Inventory integration', () => {
  let ctx: InventoryTestContext;

  beforeAll(async () => {
    ctx = await seedInventoryIntegrationTest();
  });

  afterAll(async () => {
    await cleanupInventoryIntegrationTest(ctx);
    await prisma.$disconnect();
  });

  function auth() {
    return { Authorization: `Bearer ${ctx.accessToken}` };
  }

  it('POST /inventory/reorder-points creates inventory level with reorder point', async () => {
    const res = await request(app)
      .post(`${v1}/inventory/reorder-points`)
      .set(auth())
      .send({ variantId: ctx.variantId, locationId: ctx.locationId, reorderPoint: 42 });
    expect(res.status).toBe(200);
    expect(res.body.variantId).toBe(ctx.variantId);
    expect(res.body.locationId).toBe(ctx.locationId);
    expect(Number(res.body.reorderPoint)).toBe(42);
  });

  it('POST /inventory/reorder-points updates existing reorder point', async () => {
    const res = await request(app)
      .post(`${v1}/inventory/reorder-points`)
      .set(auth())
      .send({ variantId: ctx.variantId, locationId: ctx.locationId, reorderPoint: 7 });
    expect(res.status).toBe(200);
    expect(Number(res.body.reorderPoint)).toBe(7);
    const row = await prisma.inventoryLevel.findUnique({
      where: { variantId_locationId: { variantId: ctx.variantId, locationId: ctx.locationId } },
    });
    expect(row && Number(row.reorderPoint)).toBe(7);
  });

  it('POST /inventory/safety-stock upserts reorder quantity (safety / reorder qty)', async () => {
    const res = await request(app)
      .post(`${v1}/inventory/safety-stock`)
      .set(auth())
      .send({ variantId: ctx.variantId, locationId: ctx.locationId, reorderQty: 15 });
    expect(res.status).toBe(200);
    expect(Number(res.body.reorderQty)).toBe(15);
  });

  it('GET /inventory/levels returns paginated list with meta', async () => {
    const res = await request(app).get(`${v1}/inventory/levels`).set(auth()).query({ page: 1, pageSize: 10 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(typeof res.body.meta.total).toBe('number');
    if (res.body.data.length > 0) {
      const row = res.body.data[0];
      expect(row).toHaveProperty('variantId');
      expect(row).toHaveProperty('variant');
      expect(row).toHaveProperty('levels');
      expect(Array.isArray(row.levels)).toBe(true);
      expect(row).toHaveProperty('totalOnHand');
      expect(row).toHaveProperty('totalAllocated');
      expect(row).toHaveProperty('totalCommitted');
      expect(row).toHaveProperty('totalExpected');
      expect(row).toHaveProperty('totalCommittedSalesOrder');
      expect(row).toHaveProperty('totalCommittedManufacturingOrder');
      expect(row).toHaveProperty('totalCommittedTransferOrder');
      expect(row).toHaveProperty('totalAvailable');
    }
  });

  it('GET /inventory/movements returns movements for filters', async () => {
    await prisma.$transaction(async tx => {
      await adjustStock(tx, ctx.variantId, ctx.locationId, 2, 'TEST_SEED');
    });
    const res = await request(app)
      .get(`${v1}/inventory/movements`)
      .set(auth())
      .query({ variantId: ctx.variantId, page: 1, pageSize: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((m: { movementType: string }) => m.movementType === 'TEST_SEED')).toBe(true);
  });

  it('does not expose DELETE on inventory movements (immutable via API)', async () => {
    const movement = await prisma.inventoryMovement.findFirst({
      where: { variantId: ctx.variantId, locationId: ctx.locationId },
    });
    expect(movement).not.toBeNull();
    const res = await request(app).delete(`${v1}/inventory-movements/${movement!.id}`).set(auth());
    expect(res.status).toBe(404);
  });

  it('keeps on-hand equal to sum of movement quantities for a variant at a location', async () => {
    await prisma.$transaction(async tx => {
      await adjustStock(tx, ctx.variantId, ctx.locationId, 5, 'TEST_CONS_A');
      await adjustStock(tx, ctx.variantId, ctx.locationId, -2, 'TEST_CONS_B');
    });
    const level = await prisma.inventoryLevel.findUnique({
      where: { variantId_locationId: { variantId: ctx.variantId, locationId: ctx.locationId } },
    });
    const agg = await prisma.inventoryMovement.aggregate({
      where: { variantId: ctx.variantId, locationId: ctx.locationId },
      _sum: { qty: true },
    });
    const onHand = Number(level?.onHand ?? 0);
    const sumMov = Number(agg._sum.qty ?? 0);
    expect(onHand).toBe(sumMov);
  });

  it('GET /inventory/negative-stock lists levels with negative on-hand', async () => {
    await prisma.inventoryLevel.update({
      where: { variantId_locationId: { variantId: ctx.variantId, locationId: ctx.locationId } },
      data: { onHand: -0.5 },
    });
    const res = await request(app).get(`${v1}/inventory/negative-stock`).set(auth()).query({ page: 1, pageSize: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data.some((row: { variantId: string }) => row.variantId === ctx.variantId)).toBe(true);
  });
});
