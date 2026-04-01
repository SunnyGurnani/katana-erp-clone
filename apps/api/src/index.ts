import { env } from './env';
import app from './app';
import { logger } from './lib/logger';
import { initStorage } from './lib/storage';

initStorage().catch(err => logger.warn({ err: err.message }, 'MinIO not available'));

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'ForgeERP API listening');
});

export default app;
