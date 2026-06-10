// ================================================================
// Node.js OpenTelemetry Instrumentation — booking-app
// Covers: frontend (3000), search (3003), user (3002)
// Traces  → OTel Collector → Tempo
// Metrics → Prometheus (prom-client scrape endpoint /metrics)
// Logs    → Winston JSON → stdout → OTel Collector → Loki
// ================================================================
// File: src/instrumentation.js   (load BEFORE all other imports)
// Start with: node --require ./src/instrumentation.js server.js
// ================================================================

'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { W3CTraceContextPropagator } = require('@opentelemetry/core');
const { CompositePropagator, W3CBaggagePropagator } = require('@opentelemetry/core');

const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown';
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  || 'http://otel-collector.observability.svc.cluster.local:4317';

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.IMAGE_TAG || '0.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
  'k8s.cluster.name': process.env.CLUSTER_NAME || 'booking-prod',
  'k8s.namespace.name': process.env.POD_NAMESPACE || 'default',
  'k8s.pod.name': process.env.POD_NAME || '',
  'k8s.node.name': process.env.NODE_NAME || '',
});

const traceExporter = new OTLPTraceExporter({ url: OTEL_ENDPOINT });
const logExporter  = new OTLPLogExporter({ url: OTEL_ENDPOINT });

const sdk = new NodeSDK({
  resource,

  spanProcessor: new BatchSpanProcessor(traceExporter, {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
    exportTimeoutMillis: 30000,
  }),

  logRecordProcessor: new BatchLogRecordProcessor(logExporter),

  // Metrics via prom-client — OTel collector scrapes /metrics
  // MetricReader is wired in metrics.js to keep this file lean

  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
    ],
  }),

  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) =>
          // Don't trace health/ready/metrics endpoints
          ['/health', '/ready', '/metrics'].includes(req.url),
        requestHook: (span, req) => {
          span.setAttribute('http.request.body.size', req.headers['content-length'] || 0);
        },
      },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },         // search, user
      '@opentelemetry/instrumentation-redis': { enabled: false },     // enable if Redis used
      '@opentelemetry/instrumentation-winston': { enabled: true },    // auto log-trace correlation
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
    console.log('OpenTelemetry SDK shut down successfully');
  } catch (err) {
    console.error('Error shutting down OpenTelemetry SDK', err);
  } finally {
    process.exit(0);
  }
});

module.exports = sdk;