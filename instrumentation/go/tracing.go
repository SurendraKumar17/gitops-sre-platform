package tracing

import (
	"context"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// Init mirrors instrumentation/node/tracing.js: it stands up an OTel
// SDK with an OTLP/gRPC exporter pointed at the shared collector,
// tagging spans with SERVICE_NAME (falls back to "unknown-service" -
// same fallback string the Node template uses).
//
// Call this once at the top of main(), and call the returned shutdown
// func via defer:
//
//	shutdown, err := tracing.Init(context.Background())
//	if err != nil {
//	    log.Fatalf("tracing init failed: %v", err)
//	}
//	defer shutdown(context.Background())
func Init(ctx context.Context) (func(context.Context) error, error) {
	serviceName := os.Getenv("SERVICE_NAME")
	if serviceName == "" {
		serviceName = "unknown-service"
	}

	collectorEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if collectorEndpoint == "" {
		collectorEndpoint = "otel-collector.observability.svc.cluster.local:4317"
	}

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(collectorEndpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}