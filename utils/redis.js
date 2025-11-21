const { createClient } = require('redis');

// Redis client singleton
let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis client
 * @returns {Promise<Object>} Redis client instance
 */
async function initRedis() {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: Too many reconnection attempts, giving up');
            return new Error('Too many retries');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
          const delay = Math.min(retries * 50, 3000);
          console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
    });

    // Event handlers
    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis: Connected and ready');
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Reconnecting...');
      isConnected = false;
    });

    redisClient.on('end', () => {
      console.log('⚠️  Redis: Connection closed');
      isConnected = false;
    });

    // Connect to Redis
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    console.error('❌ Redis initialization failed:', error.message);
    console.warn('⚠️  Server will continue without caching');
    redisClient = null;
    return null;
  }
}

/**
 * Get Redis client instance
 * @returns {Object|null} Redis client or null if not connected
 */
function getRedisClient() {
  return isConnected ? redisClient : null;
}

/**
 * Check if Redis is connected
 * @returns {boolean} Connection status
 */
function isRedisConnected() {
  return isConnected;
}

/**
 * Set a value in Redis with optional TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @returns {Promise<boolean>} Success status
 */
async function setCache(key, value, ttl = 300) {
  try {
    if (!isConnected || !redisClient) {
      return false;
    }

    const serialized = JSON.stringify(value);
    await redisClient.setEx(key, ttl, serialized);
    return true;
  } catch (error) {
    console.error('Redis setCache error:', error.message);
    return false;
  }
}

/**
 * Get a value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if not found
 */
async function getCache(key) {
  try {
    if (!isConnected || !redisClient) {
      return null;
    }

    const cached = await redisClient.get(key);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  } catch (error) {
    console.error('Redis getCache error:', error.message);
    return null;
  }
}

/**
 * Delete a key from Redis
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
async function deleteCache(key) {
  try {
    if (!isConnected || !redisClient) {
      return false;
    }

    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis deleteCache error:', error.message);
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., "comments:*")
 * @returns {Promise<number>} Number of keys deleted
 */
async function deleteCachePattern(pattern) {
  try {
    if (!isConnected || !redisClient) {
      return 0;
    }

    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    await redisClient.del(keys);
    return keys.length;
  } catch (error) {
    console.error('Redis deleteCachePattern error:', error.message);
    return 0;
  }
}

/**
 * Flush all Redis data (use with caution!)
 * @returns {Promise<boolean>} Success status
 */
async function flushCache() {
  try {
    if (!isConnected || !redisClient) {
      return false;
    }

    await redisClient.flushAll();
    return true;
  } catch (error) {
    console.error('Redis flushCache error:', error.message);
    return false;
  }
}

/**
 * Close Redis connection gracefully
 * @returns {Promise<void>}
 */
async function closeRedis() {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('✅ Redis connection closed gracefully');
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error.message);
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  flushCache,
  closeRedis,
};
