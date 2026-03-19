import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string(),
  SECRET_KEY: z.string().min(32),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(60),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().default(30),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
