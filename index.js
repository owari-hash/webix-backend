require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");

// Import optimization utilities
const { initRedis, closeRedis } = require("./utils/redis");
const { metricsMiddleware, getMetrics } = require("./middleware/metrics");
const { defaultLimiter } = require("./middleware/rateLimiter");

const app = express();
const port = process.env.PORT || 3001;

// Initialize Redis on startup
initRedis().catch((err) => {
  console.warn("⚠️  Failed to initialize Redis:", err.message);
  console.warn("⚠️  Server will continue without caching");
});

// MongoDB connection pool - stores connections for each subdomain
const dbConnections = {};

// Database existence cache (to avoid repeated admin queries)
const dbExistenceCache = new Map();
const DB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Central organization database connection (for Organization collection)
let centralDbConnection = null;
const CENTRAL_DB_NAME = process.env.CENTRAL_DB_NAME || "webix-udirdlaga";

// Optional: Subdomain to database name mapping (for custom database names)
// If not provided, system will auto-detect using webix-{subdomain} pattern
const subdomainToDb = process.env.SUBDOMAIN_DB_MAPPING
  ? JSON.parse(process.env.SUBDOMAIN_DB_MAPPING)
  : {
      // Example mappings (can be overridden via environment variable)
      // udirdlaga: "webix-udirdlaga",
      // goytest: "webix_goytest",
    };

// MongoDB base URI (without database name)
const MONGODB_BASE_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";

// CORS configuration for frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8002",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Response compression (gzip) - reduces bandwidth by 60-80%
app.use(compression());

// Metrics collection middleware
if (process.env.ENABLE_METRICS !== 'false') {
  app.use(metricsMiddleware);
}

// Body parsing middleware - increased limits for large payloads
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Increase server timeout for large uploads
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
});

// Middleware to detect subdomain and connect to appropriate database
app.use(async (req, res, next) => {
  try {
    // Extract subdomain from host header or custom headers
    // Handles: test.anzaidev.fun, localhost:3001, 127.0.0.1:3001, etc.
    const host = req.get("host") || "";
    let subdomain = host.split(".")[0];

    // Check for custom headers (useful for local development or proxies)
    if (req.headers["x-original-host"]) {
      const originalHost = req.headers["x-original-host"];
      subdomain = originalHost.split(".")[0];
    } else if (req.headers["x-tenant-subdomain"]) {
      subdomain = req.headers["x-tenant-subdomain"];
    }

    // Remove port if present (e.g., "localhost:3001" -> "localhost")
    subdomain = subdomain.split(":")[0];

    // Check if subdomain is localhost
    const isLocalhost = subdomain === "localhost" || subdomain === "127.0.0.1";
    const isMapped = subdomainToDb && subdomainToDb.hasOwnProperty(subdomain);

    // Get database name: use mapping if exists, otherwise auto-detect
    let dbName;
    if (isMapped) {
      // Use mapped database name
      dbName = subdomainToDb[subdomain];
    } else if (isLocalhost) {
      // For localhost, try default database or use webix-localhost pattern
      dbName = process.env.DEFAULT_DATABASE || "webix-localhost";
    } else {
      // Auto-detect: Try webix_{subdomain} first, then webix-{subdomain}
      // Prefer underscore pattern which matches your existing DB
      dbName = `webix_${subdomain}`;

      // OPTIMIZED: Check database existence with caching
      // Use one of the existing connections to get database list
      let dbExists = false;
      let availableDbs = [];

      // Check cache first
      const cacheKey = `db_exists:${dbName}`;
      const cached = dbExistenceCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < DB_CACHE_TTL) {
        // Use cached result
        dbExists = cached.exists;
        availableDbs = cached.availableDbs || [];
        console.log(`✅ Cache HIT: Database existence check for ${dbName}`);
      } else {
        // Cache miss - query MongoDB
        console.log(`❌ Cache MISS: Checking database existence for ${dbName}`);
        
        try {
          // Get an existing connection or create temporary one
          let checkConn;
          const existingDbNames = Object.keys(dbConnections);

          if (existingDbNames.length > 0) {
            // Use an existing connection
            checkConn = dbConnections[existingDbNames[0]];
          } else {
            // Create a temporary connection
            checkConn = await mongoose.createConnection(
              `${MONGODB_BASE_URI}/admin`
            );
          }

          // List all databases
          const client = checkConn.getClient();
          const adminDb = client.db("admin");
          const dbListResult = await adminDb.admin().listDatabases();

          // Close temporary connection if we created one
          if (existingDbNames.length === 0) {
            await checkConn.close();
          }

          availableDbs = dbListResult.databases
            .filter(
              (db) => db.name.startsWith("webix-") || db.name.startsWith("webix_")
            )
            .map((db) => db.name);

          // Check if database exists (try both hyphen and underscore patterns)
          dbExists = dbListResult.databases.some((db) => db.name === dbName);

          // If not found with hyphen, try underscore pattern
          if (!dbExists && !isLocalhost && !isMapped) {
            const dbNameUnderscore = `webix_${subdomain}`;
            dbExists = dbListResult.databases.some(
              (db) => db.name === dbNameUnderscore
            );
            if (dbExists) {
              dbName = dbNameUnderscore;
            }
          }
          
          // Cache the result
          dbExistenceCache.set(cacheKey, {
            exists: dbExists,
            availableDbs: availableDbs,
            timestamp: Date.now(),
          });
        } catch (checkError) {
          console.error("Database check error:", checkError);
          // If we can't check, BLOCK access
          return res.status(500).json({
            success: false,
            message: "Cannot verify database existence",
            error: checkError.message,
            subdomain: subdomain,
            database: dbName,
          });
        }
      }

      // BLOCK if database doesn't exist 
      if (!dbExists) {
        return res.status(404).json({
          success: false,
          message: "Database does NOT exist",
          error: `Database "${dbName}" was not found in MongoDB.`,
          subdomain: subdomain,
          requestedDatabase: dbName,
          availableDatabases: availableDbs,
          hint: "Only existing databases can be accessed. Create the database in MongoDB first.",
        });
      }
    }

    // Create or reuse database connection
    if (!dbConnections[dbName]) {
      const dbUri = `${MONGODB_BASE_URI}/${dbName}`;
      const connection = await mongoose.createConnection(dbUri, {
        maxPoolSize: 50, // OPTIMIZED: Increased from 10 to 50 for better concurrency
        minPoolSize: 5,  // Maintain minimum connections
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 30000, // Close idle connections after 30s
      });

      dbConnections[dbName] = connection;
      console.log(
        `✅ Connected to database: ${dbName} (subdomain: ${subdomain})`
      );
    }

    // Connect to central organization database (if not already connected)
    if (!centralDbConnection) {
      const centralDbUri = `${MONGODB_BASE_URI}/${CENTRAL_DB_NAME}`;
      centralDbConnection = await mongoose.createConnection(centralDbUri, {
        maxPoolSize: 50, // OPTIMIZED: Increased from 10 to 50
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 30000,
      });
      console.log(`✅ Connected to central database: ${CENTRAL_DB_NAME}`);
    }

    // Check Organization License
    // We use the central database to check the subscription status
    // We check if subdomain exists and it's not a generic localhost access (unless headers provided)
    const isGenericLocalhost = (subdomain === "localhost" || subdomain === "127.0.0.1") && 
                              !req.headers["x-original-host"] && 
                              !req.headers["x-tenant-subdomain"];

    // DEBUG LOGS
    console.log(`[License Check] Subdomain: ${subdomain}, GenericLocalhost: ${isGenericLocalhost}, DB Connected: ${!!centralDbConnection}`);

    if (subdomain && !isGenericLocalhost && centralDbConnection) {
      try {
        const organizationsCollection =
          centralDbConnection.collection("organizations");
        const organization = await organizationsCollection.findOne({
          subdomain: subdomain,
        });

        console.log(`[License Check] Organization found: ${!!organization}`);

        if (organization) {
          console.log(`[License Check] Subscription:`, organization.subscription);
          
          const isLicenseActive =
            organization.subscription &&
            organization.subscription.status === "active" &&
            (!organization.subscription.endDate ||
              new Date(organization.subscription.endDate) > new Date());

          console.log(`[License Check] Is Active: ${isLicenseActive}`);

          if (!isLicenseActive) {
            console.log(`[License Check] BLOCKING ACCESS for ${subdomain}`);
            return res.status(403).json({
              success: false,
              message: "Organization license is expired or inactive",
              code: "LICENSE_EXPIRED",
              organization: {
                name: organization.name,
                displayName: organization.displayName,
                contactEmail:
                  organization.email && organization.email[0]
                    ? organization.email[0]
                    : null,
              },
            });
          }
        }
      } catch (licenseError) {
        console.error("License check error:", licenseError);
        // We don't block on error, but log it. 
        // Alternatively, we could block if strict license checking is required.
      }
    }

    // Attach database connections to request object
    req.db = dbConnections[dbName]; // Org-specific database
    req.dbName = dbName;
    req.subdomain = subdomain;
    req.centralDb = centralDbConnection; // Central organization database
    req.centralDbName = CENTRAL_DB_NAME;

    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Import routes
const authRoutes = require("./routes/auth");
const webtoonRoutes = require("./routes/webtoon");
const uploadRoutes = require("./routes/upload");
const usersRoutes = require("./routes/users");
const commentsRoutes = require("./routes/comments");
const organizationsRoutes = require("./routes/organizations");
const { authenticate, authorize } = require("./middleware/auth");
const { authLimiter, uploadLimiter, publicLimiter } = require("./middleware/rateLimiter");

// Serve uploaded files as static
app.use(
  "/uploads",
  express.static("uploads", {
    // Enable serving files from subdirectories
    dotfiles: "ignore",
    etag: true,
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    index: false,
    maxAge: "1d",
    redirect: false,
    setHeaders: function (res, path) {
      res.set("x-timestamp", Date.now().toString());
    },
  })
);

// Metrics endpoint (no rate limiting for monitoring)
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", "text/plain");
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send("Error generating metrics");
  }
});

// Mount routes with appropriate rate limiting
app.use("/api2/auth", authLimiter, authRoutes); // Strict: 5 req/15min
app.use("/api2/webtoon", publicLimiter, webtoonRoutes); // Lenient: 200 req/15min
app.use("/api2/upload", uploadLimiter, uploadRoutes); // Medium: 10 req/15min
app.use("/api2/users", defaultLimiter, usersRoutes); // Default: 100 req/15min
app.use("/api2/comments", publicLimiter, commentsRoutes); // Lenient: 200 req/15min
app.use("/api2/organizations", publicLimiter, organizationsRoutes); // Lenient: 200 req/15min

// Welcome route - shows subdomain and database separation
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: `Welcome ${req.subdomain}!`,
    welcome: `Тавтай морилно уу, ${req.subdomain}!`,
    subdomain: req.subdomain,
    database: req.dbName,
    databaseSeparation: "✅ Database separation confirmed",
    host: req.get("host"),
    timestamp: new Date().toISOString(),
  });
});

// Welcome route with detailed database info
app.get("/api2/welcome", (req, res) => {
  res.json({
    success: true,
    message: `Welcome ${req.subdomain}!`,
    welcome: `Тавтай морилно уу, ${req.subdomain}!`,
    subdomain: req.subdomain,
    database: req.dbName,
    databaseSeparation: "✅ Database separation confirmed",
    host: req.get("host"),
    connectionStatus: dbConnections[req.dbName] ? "Connected" : "Not connected",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/api2/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    subdomain: req.subdomain,
    database: req.dbName,
    timestamp: new Date().toISOString(),
  });
});

// Protected route example - requires authentication
app.get("/api2/protected", authenticate, (req, res) => {
  res.json({
    success: true,
    message: "You have access to protected content",
    user: req.user,
    subdomain: req.subdomain,
    database: req.dbName,
  });
});

// Admin only route example - requires authentication and admin role
app.get("/api2/admin", authenticate, authorize("admin"), (req, res) => {
  res.json({
    success: true,
    message: "Admin access granted",
    user: req.user,
    subdomain: req.subdomain,
    database: req.dbName,
  });
});

// Test database connection endpoint
app.get("/api2/test-db", async (req, res) => {
  try {
    // Test the connection by listing collections
    const collections = await req.db.db.listCollections().toArray();

    res.json({
      success: true,
      message: "Database connection successful",
      database: req.dbName,
      subdomain: req.subdomain,
      collections: collections.map((col) => col.name),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database test failed",
      error: error.message,
      database: req.dbName,
    });
  }
});

// Dynamic data query endpoint - Get all documents from a collection
app.get("/api2/collection/:collectionName", async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { limit = 100, skip = 0, sort = "_id" } = req.query;

    const collection = req.db.db.collection(collectionName);

    // Get total count
    const total = await collection.countDocuments();

    // Get documents with pagination
    const documents = await collection
      .find({})
      .sort({ [sort]: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();

    res.json({
      success: true,
      message: `Data retrieved from ${collectionName}`,
      database: req.dbName,
      subdomain: req.subdomain,
      collection: collectionName,
      total: total,
      count: documents.length,
      limit: parseInt(limit),
      skip: parseInt(skip),
      data: documents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch data",
      error: error.message,
      database: req.dbName,
      collection: req.params.collectionName,
    });
  }
});

// Dynamic data query endpoint - Get single document by ID
app.get("/api2/collection/:collectionName/:id", async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    const collection = req.db.db.collection(collectionName);

    // Try to find by _id (handle both ObjectId and string)
    let document;
    try {
      // Try as ObjectId first
      const ObjectId = mongoose.Types.ObjectId;
      document = await collection.findOne({ _id: new ObjectId(id) });
    } catch (e) {
      // If ObjectId fails, try as string
      document = await collection.findOne({ _id: id });
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
        database: req.dbName,
        collection: collectionName,
        id: id,
      });
    }

    res.json({
      success: true,
      message: `Document retrieved from ${collectionName}`,
      database: req.dbName,
      subdomain: req.subdomain,
      collection: collectionName,
      data: document,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch document",
      error: error.message,
      database: req.dbName,
      collection: req.params.collectionName,
    });
  }
});

// Dynamic data query endpoint - Search/filter documents
app.get("/api2/collection/:collectionName/search", async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { q, field, limit = 50 } = req.query;

    const collection = req.db.db.collection(collectionName);

    // Build query
    let query = {};
    if (q && field) {
      // Search in specific field
      query[field] = { $regex: q, $options: "i" }; // Case-insensitive search
    } else if (q) {
      // Search in all text fields (basic implementation)
      query = {
        $or: [
          { title: { $regex: q, $options: "i" } },
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
        ],
      };
    }

    const documents = await collection
      .find(query)
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      message: `Search results from ${collectionName}`,
      database: req.dbName,
      subdomain: req.subdomain,
      collection: collectionName,
      query: query,
      count: documents.length,
      data: documents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
      database: req.dbName,
      collection: req.params.collectionName,
    });
  }
});

// Get database stats - shows collection counts
app.get("/api2/db-stats", async (req, res) => {
  try {
    const collections = await req.db.db.listCollections().toArray();
    const stats = {};

    // Get document count for each collection
    for (const col of collections) {
      const collection = req.db.db.collection(col.name);
      const count = await collection.countDocuments();
      stats[col.name] = count;
    }

    res.json({
      success: true,
      message: "Database statistics",
      database: req.dbName,
      subdomain: req.subdomain,
      collections: stats,
      totalCollections: collections.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get database stats",
      error: error.message,
      database: req.dbName,
    });
  }
});

// Insert test data into a collection
app.post("/api2/collection/:collectionName/insert", async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { data } = req.body; // Can be single object or array

    const collection = req.db.db.collection(collectionName);

    let result;
    if (Array.isArray(data)) {
      // Insert multiple documents
      result = await collection.insertMany(data);
    } else {
      // Insert single document
      result = await collection.insertOne(data);
    }

    res.json({
      success: true,
      message: `Test data inserted into ${collectionName}`,
      database: req.dbName,
      subdomain: req.subdomain,
      collection: collectionName,
      insertedCount: result.insertedCount || (result.insertedId ? 1 : 0),
      insertedIds: result.insertedIds || [result.insertedId],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to insert test data",
      error: error.message,
      database: req.dbName,
      collection: req.params.collectionName,
    });
  }
});

// Seed test data - Creates sample collections with test data
app.post("/api2/seed", async (req, res) => {
  try {
    const db = req.db.db;
    const results = {};

    // Seed Users collection
    const usersCollection = db.collection("users");
    const usersData = [
      {
        name: `${req.subdomain} User 1`,
        email: `user1@${req.subdomain}.com`,
        role: "admin",
        subdomain: req.subdomain,
        database: req.dbName,
        createdAt: new Date(),
      },
      {
        name: `${req.subdomain} User 2`,
        email: `user2@${req.subdomain}.com`,
        role: "user",
        subdomain: req.subdomain,
        database: req.dbName,
        createdAt: new Date(),
      },
      {
        name: `${req.subdomain} User 3`,
        email: `user3@${req.subdomain}.com`,
        role: "viewer",
        subdomain: req.subdomain,
        database: req.dbName,
        createdAt: new Date(),
      },
    ];
    const usersResult = await usersCollection.insertMany(usersData);
    results.users = {
      inserted: usersResult.insertedCount,
      ids: Object.values(usersResult.insertedIds),
    };

    // Seed Webtoons collection
    const webtoonsCollection = db.collection("webtoons");
    const webtoonsData = [
      {
        title: `${req.subdomain} Webtoon 1`,
        description: `This is a test webtoon from ${req.subdomain} subdomain`,
        author: `${req.subdomain} Author`,
        subdomain: req.subdomain,
        database: req.dbName,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
      {
        title: `${req.subdomain} Webtoon 2`,
        description: `Another test webtoon from ${req.subdomain}`,
        author: `${req.subdomain} Author 2`,
        subdomain: req.subdomain,
        database: req.dbName,
        status: "draft",
        views: 0,
        createdAt: new Date(),
      },
    ];
    const webtoonsResult = await webtoonsCollection.insertMany(webtoonsData);
    results.webtoons = {
      inserted: webtoonsResult.insertedCount,
      ids: Object.values(webtoonsResult.insertedIds),
    };

    // Seed Settings collection
    const settingsCollection = db.collection("settings");
    const settingsData = {
      subdomain: req.subdomain,
      database: req.dbName,
      siteName: `${req.subdomain} Site`,
      theme: "default",
      language: "mn",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const settingsResult = await settingsCollection.insertOne(settingsData);
    results.settings = {
      inserted: settingsResult.insertedId ? 1 : 0,
      id: settingsResult.insertedId,
    };

    res.json({
      success: true,
      message: `Test data seeded successfully for ${req.subdomain}`,
      database: req.dbName,
      subdomain: req.subdomain,
      collections: results,
      totalInserted:
        results.users.inserted +
        results.webtoons.inserted +
        results.settings.inserted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to seed test data",
      error: error.message,
      database: req.dbName,
      subdomain: req.subdomain,
    });
  }
});

// Test database separation - Compare data across subdomains
app.get("/api2/test-separation", async (req, res) => {
  try {
    const db = req.db.db;
    const results = {
      currentSubdomain: req.subdomain,
      currentDatabase: req.dbName,
      collections: {},
    };

    // Get data from current database
    const collections = ["users", "webtoons", "settings"];
    for (const colName of collections) {
      const collection = db.collection(colName);
      const count = await collection.countDocuments();
      const sample = await collection.find({}).limit(2).toArray();

      results.collections[colName] = {
        count: count,
        sample: sample.map((doc) => ({
          _id: doc._id,
          subdomain: doc.subdomain,
          database: doc.database,
          // Include key fields for identification
          name: doc.name || doc.title || doc.siteName || "N/A",
        })),
      };
    }

    res.json({
      success: true,
      message: "Database separation test results",
      test: results,
      verification: {
        allDocumentsHaveSubdomain: Object.values(results.collections).every(
          (col) =>
            col.sample.every((doc) => doc.subdomain === req.subdomain) ||
            col.count === 0
        ),
        allDocumentsHaveDatabase: Object.values(results.collections).every(
          (col) =>
            col.sample.every((doc) => doc.database === req.dbName) ||
            col.count === 0
        ),
      },
      instructions: {
        step1: `Visit ${req.subdomain}.anzaidev.fun/api2/seed to add test data`,
        step2: `Visit different subdomains to verify data is separated`,
        step3: `Compare /api2/test-separation results from different subdomains`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to test database separation",
      error: error.message,
      database: req.dbName,
      subdomain: req.subdomain,
    });
  }
});

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
    hint: "Check the available endpoints in the server logs",
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 MongoDB base URI: ${MONGODB_BASE_URI}`);
  console.log(
    `🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:8002"}`
  );
  console.log(`\n📝 Subdomain mapping:`);
  if (subdomainToDb && Object.keys(subdomainToDb).length > 0) {
    Object.entries(subdomainToDb).forEach(([subdomain, db]) => {
      console.log(`   ${subdomain} -> ${db}`);
    });
  } else {
    console.log(`   Using dynamic auto-detection: webix-{subdomain}`);
    if (process.env.DEFAULT_DATABASE) {
      console.log(
        `   Default database (localhost): ${process.env.DEFAULT_DATABASE}`
      );
    }
  }
  console.log(`\n✨ Dynamic subdomain detection enabled`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`\n🔐 Authentication:`);
  console.log(`   POST /api2/auth/register - Register new user`);
  console.log(`   POST /api2/auth/login - Login user`);
  console.log(`   GET  /api2/auth/me - Get current user (protected)`);
  console.log(`   POST /api2/auth/logout - Logout user`);
  console.log(`\n👥 User Management:`);
  console.log(`   GET    /api2/users - Get all users (Admin only)`);
  console.log(`   GET    /api2/users/:id - Get user by ID`);
  console.log(`   POST   /api2/users - Create new user (Admin only)`);
  console.log(`   PUT    /api2/users/:id - Update user`);
  console.log(
    `   PATCH  /api2/users/:id/premium - Toggle premium (Admin only)`
  );
  console.log(`   DELETE /api2/users/:id - Delete user (Admin only)`);
  console.log(`\n🔒 Protected Routes:`);
  console.log(
    `   GET  /api2/protected - Protected route (requires authentication)`
  );
  console.log(`   GET  /api2/admin - Admin only route (requires admin role)`);
  console.log(`\n📚 Webtoon/Comics:`);
  console.log(`   POST   /api2/webtoon/comic - Create new comic`);
  console.log(`   GET    /api2/webtoon/comics - Get all comics`);
  console.log(`   GET    /api2/webtoon/comic/:id - Get comic by ID`);
  console.log(`   PUT    /api2/webtoon/comic/:id - Update comic`);
  console.log(`   DELETE /api2/webtoon/comic/:id - Delete comic`);
  console.log(
    `   POST   /api2/webtoon/comic/:comicId/chapter - Create chapter`
  );
  console.log(`   GET    /api2/webtoon/comic/:comicId/chapters - Get chapters`);
  console.log(`   GET    /api2/webtoon/chapter/:id - Get chapter by ID`);
  console.log(`   PUT    /api2/webtoon/chapter/:id - Update chapter`);
  console.log(
    `   PATCH  /api2/webtoon/chapter/:id - Append images to chapter ⭐`
  );
  console.log(`   DELETE /api2/webtoon/chapter/:id - Delete chapter`);
  console.log(`\n📤 File Uploads:`);
  console.log(`   POST /api2/upload/cover - Upload cover image`);
  console.log(`   POST /api2/upload/pages - Upload chapter pages (multiple)`);
  console.log(`   POST /api2/upload/single - Upload single image`);
  console.log(`\n📊 Data Management:`);
  console.log(`   POST /api2/seed - Seed test data`);
  console.log(`   GET  /api2/test-separation - Test database separation`);
  console.log(`   GET  /api2/collection/:name - Get collection data`);
  console.log(`   POST /api2/collection/:name/insert - Insert test data`);
  console.log(`   GET  /api2/db-stats - Database statistics`);
  console.log(`\n⚙️  Server Configuration:`);
  console.log(`   Body Size Limit: 100mb`);
  console.log(`   Request Timeout: 5 minutes`);
  console.log(`   Token Expiration: 7 days`);
});

// Set server timeout to 5 minutes for large uploads
server.timeout = 300000; // 5 minutes in milliseconds
server.keepAliveTimeout = 310000; // slightly longer than timeout
server.headersTimeout = 320000; // slightly longer than keepAliveTimeout

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM signal received: closing HTTP server');
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    // Close Redis connection
    await closeRedis();
    
    // Close all database connections
    for (const [dbName, connection] of Object.entries(dbConnections)) {
      try {
        await connection.close();
        console.log(`✅ Closed database connection: ${dbName}`);
      } catch (error) {
        console.error(`Error closing database ${dbName}:`, error.message);
      }
    }
    
    // Close central database connection
    if (centralDbConnection) {
      try {
        await centralDbConnection.close();
        console.log(`✅ Closed central database connection`);
      } catch (error) {
        console.error('Error closing central database:', error.message);
      }
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server');
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    // Close Redis connection
    await closeRedis();
    
    // Close all database connections
    for (const [dbName, connection] of Object.entries(dbConnections)) {
      try {
        await connection.close();
        console.log(`✅ Closed database connection: ${dbName}`);
      } catch (error) {
        console.error(`Error closing database ${dbName}:`, error.message);
      }
    }
    
    // Close central database connection
    if (centralDbConnection) {
      try {
        await centralDbConnection.close();
        console.log(`✅ Closed central database connection`);
      } catch (error) {
        console.error('Error closing central database:', error.message);
      }
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });
});
