'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const {
  getNodeAutoInstrumentations,
} = require('@opentelemetry/auto-instrumentations-node');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-grpc');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.SERVICE_NAME || 'unknown-service',
  }),

  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://otel-collector.observability.svc.cluster.local:4317',
  }),

  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
});