import { env } from './env';
import app from './app';
import { initStorage } from './lib/storage';

initStorage().catch(err => console.warn('MinIO not available:', err.message));

app.listen(env.PORT, () => console.log(`ForgeERP API running on port ${env.PORT}`));

export default app;
