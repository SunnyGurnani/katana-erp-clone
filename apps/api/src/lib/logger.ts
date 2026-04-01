import pino from 'pino';
import { env } from '../env';

const level = env.LOG_LEVEL;

export const logger = pino({
  level,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
