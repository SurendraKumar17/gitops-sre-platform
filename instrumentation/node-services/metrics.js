// ================================================================
// Node.js — Enterprise Prometheus Metrics (RED pattern)
// Covers: frontend (3000), search (3003), user (3002)
// Exposes: GET /metrics  (scraped by Prometheus via ServiceMonitor)
// ================================================================
// File: src/metrics.js
// ================================================================

'use strict';

const promClient = require('prom-client');

const SERVICE = process.env.SERVICE_NAME || 'unknown';
const register = new promClient.Registry();

// ── Default system metrics (CPU, memory, event loop, GC) ──────
promClient.collectDefaultMetrics({
  register,
  prefix: `${SERVICE}_`,
  labels: {
    service: SERVICE,
    env: process.env.NODE_ENV || 'production',
    cluster: process.env.CLUSTER_NAME || 'booking-prod',
  },
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ── R — Request Rate ──────────────────────────────────────────
const httpRequestsTotal = new promClient.Counter({
  name: `${SERVICE}_http_requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── E — Error Rate ────────────────────────────────────────────
const httpRequestErrorsTotal = new promClient.Counter({
  name: `${SERVICE}_http_request_errors_total`,
  help: 'Total number of HTTP request errors (4xx/5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── D — Duration (Histogram with SLO-aligned buckets) ─────────
const httpRequestDurationSeconds = new promClient.Histogram({
  name: `${SERVICE}_http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// ── Active connections gauge ──────────────────────────────────
const httpActiveRequests = new promClient.Gauge({
  name: `${SERVICE}_http_active_requests`,
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method'],
  registers: [register],
});

// ── DB connection pool (wire to your pg Pool events) ──────────
const dbPoolSize = new promClient.Gauge({
  name: `${SERVICE}_db_pool_size`,
  help: 'PostgreSQL connection pool size',
  registers: [register],
});
const dbPoolWaiting = new promClient.Gauge({
  name: `${SERVICE}_db_pool_waiting`,
  help: 'PostgreSQL waiting clients in pool',
  registers: [register],
});
const dbQueryDurationSeconds = new promClient.Histogram({
  name: `${SERVICE}_db_query_duration_seconds`,
  help: 'PostgreSQL query duration in seconds',
  labelNames: ['query_name', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// ── Business metrics ──────────────────────────────────────────
const businessEventsTotal = new promClient.Counter({
  name: `${SERVICE}_business_events_total`,
  help: 'Total business events by type',
  labelNames: ['event_type', 'status'],
  registers: [register],
});

// ── Express middleware ─────────────────────────────────────────
/**
 * Usage in your Express app:
 *   const { metricsMiddleware, metricsHandler, register } = require('./metrics');
 *   app.use(metricsMiddleware);
 *   app.get('/metrics', metricsHandler);
 */
function metricsMiddleware(req, res, next) {
  if (['/health', '/ready', '/metrics'].includes(req.path)) return next();

  const route = req.route?.path || req.path || 'unknown';
  const method = req.method;
  const end = httpRequestDurationSeconds.startTimer({ method, route });
  httpActiveRequests.inc({ method });

  res.on('finish', () => {
    const statusCode = String(res.statusCode);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    end({ status_code: statusCode });
    httpActiveRequests.dec({ method });

    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc({ method, route, status_code: statusCode });
    }
  });

  next();
}

async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

// ── DB pool wiring helper ──────────────────────────────────────
/**
 * Call this after creating your pg.Pool:
 *   const { wireDbPool } = require('./metrics');
 *   wireDbPool(pool);
 */
function wireDbPool(pool) {
  const refresh = () => {
    dbPoolSize.set(pool.totalCount);
    dbPoolWaiting.set(pool.waitingCount);
  };
  pool.on('connect', refresh);
  pool.on('acquire', refresh);
  pool.on('remove', refresh);
}

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  wireDbPool,
  // raw instruments — use in route handlers for business events
  businessEventsTotal,
  dbQueryDurationSeconds,
  httpRequestDurationSeconds,
};