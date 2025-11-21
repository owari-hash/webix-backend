const { getCache, setCache } = require('../utils/redis');

/**
 * Cache middleware for GET requests
 * Caches responses in Redis with configurable TTL
 * 
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @param {function} keyGenerator - Optional custom key generator function
 * @returns {function} Express middleware
 */
function cacheMiddleware(ttl = 300, keyGenerator = null) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : generateCacheKey(req);

      // Try to get from cache
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        // Cache hit
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(cachedData);
      }

      // Cache miss - continue to route handler
      console.log(`❌ Cache MISS: ${cacheKey}`);

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function (data) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          setCache(cacheKey, data, ttl).catch((err) => {
            console.error('Failed to cache response:', err.message);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error.message);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Generate cache key from request
 * Format: subdomain:path:query
 * 
 * @param {Object} req - Express request object
 * @returns {string} Cache key
 */
function generateCacheKey(req) {
  const subdomain = req.subdomain || 'default';
  const path = req.path;
  const query = JSON.stringify(req.query);
  const userId = req.user?.id || 'anonymous';

  // Include user ID for personalized content
  if (req.user) {
    return `${subdomain}:${path}:${userId}:${query}`;
  }

  return `${subdomain}:${path}:${query}`;
}

/**
 * Cache invalidation middleware
 * Invalidates cache for specific patterns after mutations
 * 
 * @param {string|string[]} patterns - Cache key patterns to invalidate
 * @returns {function} Express middleware
 */
function invalidateCache(patterns) {
  return async (req, res, next) => {
    const { deleteCachePattern } = require('../utils/redis');

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override res.json to invalidate cache after successful response
    res.json = async function (data) {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const patternsArray = Array.isArray(patterns) ? patterns : [patterns];

        for (const pattern of patternsArray) {
          try {
            const deleted = await deleteCachePattern(pattern);
            if (deleted > 0) {
              console.log(`🗑️  Invalidated ${deleted} cache entries for pattern: ${pattern}`);
            }
          } catch (error) {
            console.error(`Failed to invalidate cache for pattern ${pattern}:`, error.message);
          }
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Create cache key for specific resource types
 */
const cacheKeys = {
  comics: (subdomain) => `${subdomain}:comics:*`,
  comic: (subdomain, comicId) => `${subdomain}:comic:${comicId}:*`,
  chapters: (subdomain, comicId) => `${subdomain}:chapters:${comicId}:*`,
  chapter: (subdomain, chapterId) => `${subdomain}:chapter:${chapterId}:*`,
  comments: (subdomain, resourceId) => `${subdomain}:comments:${resourceId}:*`,
  users: (subdomain) => `${subdomain}:users:*`,
  user: (subdomain, userId) => `${subdomain}:user:${userId}:*`,
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  generateCacheKey,
  cacheKeys,
};
