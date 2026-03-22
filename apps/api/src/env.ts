import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string(),
  SECRET_KEY: z.string().min(32),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(60),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().default(30),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  // MinIO (optional — file uploads disabled if not configured)
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin123'),
  MINIO_BUCKET: z.string().default('forgeerp'),
  MINIO_USE_SSL: z.string().default('false'),
  MINIO_PUBLIC_URL: z.string().default('http://localhost/files'),
});

export const env = schema.parse(process.env);
