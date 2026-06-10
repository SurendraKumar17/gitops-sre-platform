// ================================================================
// Node.js — Structured Logger (Winston + OTel trace correlation)
// Outputs JSON logs to stdout → picked up by OTel Collector → Loki
// Trace/span IDs injected automatically via OTel Winston instrumentation
// ================================================================
// File: src/logger.js
// ================================================================

'use strict';

const winston = require('winston');
const { trace, context } = require('@opentelemetry/api');

const SERVICE = process.env.SERVICE_NAME || 'unknown';
const ENV     = process.env.NODE_ENV     || 'production';
const CLUSTER = process.env.CLUSTER_NAME || 'booking-prod';

// ── Inject active OTel trace/span IDs into every log line ─────
const traceContextFormat = winston.format((info) => {
  const span = trace.getActiveSpan(context.active());
  if (span) {
    const ctx = span.spanContext();
    info['trace.id']  = ctx.traceId;
    info['span.id']   = ctx.spanId;
    info['trace.flags'] = ctx.traceFlags;
  }
  return info;
});

const logger = winston.createLogger({
  level: ENV === 'production' ? 'info' : 'debug',

  format: winston.format.combine(
    winston.format.timestamp({ format: 'ISO' }),
    traceContextFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),

  defaultMeta: {
    service: SERVICE,
    env: ENV,
    cluster: CLUSTER,
    // pod name injected at runtime via downward API env var
    pod: process.env.POD_NAME || undefined,
  },

  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],

  exitOnError: false,
});

// ── Express request logger middleware ─────────────────────────
/**
 * Usage: app.use(requestLogger);
 * Skips health/ready/metrics endpoints automatically.
 */
function requestLogger(req, res, next) {
  if (['/health', '/ready', '/metrics'].includes(req.path)) return next();

  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level]('http_request', {
      method:      req.method,
      path:        req.path,
      status_code: res.statusCode,
      duration_ms: ms,
      user_agent:  req.headers['user-agent'],
      request_id:  req.headers['x-request-id'],
    });
  });

  next();
}

module.exports = { logger, requestLogger };