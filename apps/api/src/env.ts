import 'dotenv/config';
import { z } from 'zod';

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const schema = z.object({
  DATABASE_URL: z.string(),
  SECRET_KEY: z.string().min(32),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(60),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().default(30),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  /** HMAC secret for POST /api/v1/webhooks/inbound (optional until that route is used) */
  WEBHOOK_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  // MinIO (optional — file uploads disabled if not configured)
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin123'),
  MINIO_BUCKET: z.string().default('forgeerp'),
  MINIO_USE_SSL: z.string().default('false'),
  MINIO_PUBLIC_URL: z.string().default('http://localhost/files'),
  QUICKBOOKS_CLIENT_ID: z.string().default(''),
  QUICKBOOKS_CLIENT_SECRET: z.string().default(''),
  QUICKBOOKS_REDIRECT_URI: z.string().default('http://localhost:3000/dashboard/integrations/callback'),
  QUICKBOOKS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  QUICKBOOKS_SCOPES: z.string().default('com.intuit.quickbooks.accounting'),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional(),
  /** Public web app URL (vendor PO links, emails) */
  APP_PUBLIC_URL: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

export const env = schema.parse(process.env);
