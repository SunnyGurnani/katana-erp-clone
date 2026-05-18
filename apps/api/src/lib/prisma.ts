import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  transactionOptions: {
    timeout: 30_000,      // 30 s hard cap per transaction
    maxWait: 5_000,       // 5 s to acquire a connection
    isolationLevel: 'ReadCommitted',
  },
});
