const rateLimit = require("express-rate-limit");
const { isRedisConnected, getRedisClient } = require("../utils/redis");

/**
 * Create rate limiter with Redis store if available, otherwise use memory store
 *
 * @param {Object} options - Rate limit options
 * @returns {function} Express middleware
 */
function createRateLimiter(options = {}) {
  const defaultOptions = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
      retryAfter: "15 minutes",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip successful requests (only count errors)
    skipSuccessfulRequests: false,
    // Skip failed requests
    skipFailedRequests: false,
    ...options,
  };

  // Use Redis store if available
  if (isRedisConnected()) {
    try {
      const RedisStore = require("rate-limit-redis");
      const redisClient = getRedisClient();

      if (redisClient) {
        defaultOptions.store = new RedisStore({
          client: redisClient,
          prefix: "rl:", // Rate limit prefix
        });
        console.log("✅ Rate limiter using Redis store");
      }
    } catch (error) {
      console.warn(
        "⚠️  Redis store not available for rate limiting, using memory store"
      );
    }
  }

  return rateLimit(defaultOptions);
}

/**
 * Default rate limiter for general API endpoints
 * 100 requests per 15 minutes
 */
const defaultLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

/**
 * Rate limiter for authentication endpoints
 * Configurable via environment variables, or disabled if DISABLE_AUTH_RATE_LIMIT=true
 * Default: 50 requests per 15 minutes (increased from 5)
 */
const authLimiter =
  process.env.DISABLE_AUTH_RATE_LIMIT === "true"
    ? (req, res, next) => next() // No rate limiting
    : createRateLimiter({
        windowMs:
          parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 50, // Increased from 5 to 50
        message: {
          success: false,
          message: "Too many authentication attempts, please try again later.",
          retryAfter: "15 minutes",
        },
        skipSuccessfulRequests: true, // Don't count successful logins
      });

/**
 * Rate limiter for upload endpoints
 * 10 requests per 15 minutes
 */
const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many upload requests, please try again later.",
  },
});

/**
 * Lenient rate limiter for public read endpoints
 * 200 requests per 15 minutes
 */
const publicLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    message: "Too many requests, please slow down.",
  },
});

/**
 * Very strict rate limiter for sensitive operations
 * 3 requests per hour
 */
const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message:
      "Too many requests for this sensitive operation, please try again later.",
    retryAfter: "1 hour",
  },
});

module.exports = {
  createRateLimiter,
  defaultLimiter,
  authLimiter,
  uploadLimiter,
  publicLimiter,
  strictLimiter,
};
