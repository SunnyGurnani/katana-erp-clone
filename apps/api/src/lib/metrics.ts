import { Registry, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'nodejs_',
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

export const memoryUsageBytes = new Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Node.js process memory usage in bytes',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const uptimeSecondsGauge = new Gauge({
  name: 'uptime_seconds',
  help: 'Process uptime in seconds',
  registers: [metricsRegistry],
});

/** Call before scraping so gauges reflect current process state */
export function refreshProcessMetrics(): void {
  const m = process.memoryUsage();
  memoryUsageBytes.labels('rss').set(m.rss);
  memoryUsageBytes.labels('heap_total').set(m.heapTotal);
  memoryUsageBytes.labels('heap_used').set(m.heapUsed);
  memoryUsageBytes.labels('external').set(m.external);
  uptimeSecondsGauge.set(process.uptime());
}
