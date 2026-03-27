import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';
import { signToken } from '../../src/lib/jwt';

export type InventoryTestContext = {
  userId: string;
  accessToken: string;
  productId: string;
  variantId: string;
  locationId: string;
};

export async function seedInventoryIntegrationTest(): Promise<InventoryTestContext> {
  const operatorRole = await prisma.role.upsert({
    where: { name: 'operator' },
    update: {},
    create: { name: 'operator', description: 'integration test' },
  });
  const user = await prisma.user.create({
    data: {
      email: `inv-it-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      fullName: 'Inventory IT',
      hashedPassword: await hashPassword('test-password-12345'),
      roleId: operatorRole.id,
    },
  });
  const accessToken = signToken(user.id, 'access');
  const product = await prisma.product.create({ data: { name: 'IT Product' } });
  const variant = await prisma.variant.create({ data: { productId: product.id, name: 'Default' } });
  const location = await prisma.location.create({ data: { name: 'IT Location' } });
  return {
    userId: user.id,
    accessToken,
    productId: product.id,
    variantId: variant.id,
    locationId: location.id,
  };
}

export async function cleanupInventoryIntegrationTest(ctx: InventoryTestContext): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { userId: ctx.userId } });
  await prisma.inventoryMovement.deleteMany({ where: { variantId: ctx.variantId } });
  await prisma.inventoryLevel.deleteMany({ where: { variantId: ctx.variantId } });
  await prisma.variant.delete({ where: { id: ctx.variantId } });
  await prisma.product.delete({ where: { id: ctx.productId } });
  await prisma.location.delete({ where: { id: ctx.locationId } });
  await prisma.user.delete({ where: { id: ctx.userId } });
}
