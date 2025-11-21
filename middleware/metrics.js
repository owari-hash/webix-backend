const promClient = require('prom-client');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics

// HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 10ms to 5s
});

// HTTP request counter
const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Active database connections gauge
const dbConnectionsGauge = new promClient.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  labelNames: ['database'],
});

// Cache hit/miss counter
const cacheCounter = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'], // operation: get/set/delete, result: hit/miss/success/error
});

// Error counter
const errorCounter = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestCounter);
register.registerMetric(dbConnectionsGauge);
register.registerMetric(cacheCounter);
register.registerMetric(errorCounter);

/**
 * Middleware to collect HTTP metrics
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;

    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestCounter.labels(method, route, statusCode).inc();
  });

  next();
}

/**
 * Update database connections gauge
 */
function updateDbConnections(dbName, count) {
  dbConnectionsGauge.labels(dbName).set(count);
}

/**
 * Record cache operation
 */
function recordCacheOperation(operation, result) {
  cacheCounter.labels(operation, result).inc();
}

/**
 * Record error
 */
function recordError(type, route) {
  errorCounter.labels(type, route).inc();
}

/**
 * Get metrics in Prometheus format
 */
async function getMetrics() {
  return register.metrics();
}

/**
 * Get metrics as JSON
 */
async function getMetricsJSON() {
  const metrics = await register.getMetricsAsJSON();
  return metrics;
}

module.exports = {
  metricsMiddleware,
  updateDbConnections,
  recordCacheOperation,
  recordError,
  getMetrics,
  getMetricsJSON,
  register,
};
