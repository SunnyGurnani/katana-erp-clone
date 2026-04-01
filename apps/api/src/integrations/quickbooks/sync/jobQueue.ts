import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import type { SyncEntityType, SyncOperation, SyncPayload } from './types';

export interface EnqueueSyncJobInput {
  integrationId: string;
  entityType: SyncEntityType;
  localEntityId: string;
  operation: SyncOperation;
  payload?: SyncPayload;
}

export function buildIdempotencyKey(input: Pick<EnqueueSyncJobInput, 'integrationId' | 'entityType' | 'localEntityId' | 'operation'>): string {
  return `${input.integrationId}:${input.entityType}:${input.localEntityId}:${input.operation}`;
}

export const jobQueue = {
  async enqueue(input: EnqueueSyncJobInput) {
    const idempotencyKey = buildIdempotencyKey(input);
    try {
      return await prisma.syncJob.upsert({
        where: { integrationId_idempotencyKey: { integrationId: input.integrationId, idempotencyKey } },
        create: {
          integrationId: input.integrationId,
          entityType: input.entityType,
          localEntityId: input.localEntityId,
          operation: input.operation,
          status: 'queued',
          attempts: 0,
          payload: input.payload ? JSON.stringify(input.payload) : null,
          idempotencyKey,
        },
        update: {
          status: 'queued',
          nextRetryAt: null,
          error: null,
          payload: input.payload ? JSON.stringify(input.payload) : undefined,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error({ err: error, idempotencyKey }, 'Failed to enqueue QuickBooks sync job');
      throw error;
    }
  },
};
