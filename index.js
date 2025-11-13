require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

// MongoDB connection pool - stores connections for each subdomain
const dbConnections = {};

// Subdomain to database name mapping
const subdomainToDb = {
  udirdlaga: "webix-udirdlaga",
  goytest: "webix_goytest",
  test: "webix-test", // test.anzaidev.fun -> webix-test database
  // Add more subdomains as needed
  // subdomain: "database-name"
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

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to detect subdomain and connect to appropriate database
app.use(async (req, res, next) => {
  try {
    // Extract subdomain from host header
    // Handles: test.anzaidev.fun, localhost:3001, 127.0.0.1:3001, etc.
    const host = req.get("host") || "";
    let subdomain = host.split(".")[0];

    // Remove port if present (e.g., "localhost:3001" -> "localhost")
    subdomain = subdomain.split(":")[0];

    // Check if subdomain is localhost
    const isLocalhost = subdomain === "localhost" || subdomain === "127.0.0.1";
    const isMapped = subdomainToDb.hasOwnProperty(subdomain);

    // Get database name: use mapping if exists, otherwise auto-detect
    let dbName;
    if (isMapped) {
      // Use mapped database name
      dbName = subdomainToDb[subdomain];
    } else if (isLocalhost) {
      // Default to 'udirdlaga' for localhost
      dbName = subdomainToDb["udirdlaga"];
    } else {
      // Auto-detect: automatically use webix-{subdomain} if database exists
      dbName = `webix-${subdomain}`;

      // Check if database actually exists in MongoDB
      // MongoDB only shows databases in listDatabases() if they have data
      // So we need to check by trying to list collections
      try {
        const checkConnection = await mongoose.createConnection(
          `${MONGODB_BASE_URI}/${dbName}`
        );
        const collections = await checkConnection.db
          .listCollections()
          .toArray();
        await checkConnection.close();

        // If database has no collections, it doesn't really exist (MongoDB creates empty DBs on first write)
        // Check via admin to see if it's in the database list
        const adminConn = await mongoose.createConnection(MONGODB_BASE_URI);
        const admin = adminConn.db.admin();
        const dbList = await admin.listDatabases();
        await adminConn.close();

        const dbInList = dbList.databases.some((db) => db.name === dbName);

        // Database doesn't exist if it's not in the list AND has no collections
        if (!dbInList && collections.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Database not found",
            error: `Database "${dbName}" does not exist in MongoDB for subdomain "${subdomain}".`,
            subdomain: subdomain,
            database: dbName,
            availableDatabases: dbList.databases
              .filter(
                (db) =>
                  db.name.startsWith("webix-") || db.name.startsWith("webix_")
              )
              .map((db) => db.name),
            hint: "Create the database in MongoDB first (it must have at least one collection with data), or add subdomain to mapping",
          });
        }
      } catch (checkError) {
        // If check fails, reject the request - database doesn't exist
        return res.status(404).json({
          success: false,
          message: "Database not found",
          error: `Database "${dbName}" does not exist or cannot be accessed: ${checkError.message}`,
          subdomain: subdomain,
          database: dbName,
        });
      }
    }

    // Create or reuse database connection
    if (!dbConnections[dbName]) {
      const dbUri = `${MONGODB_BASE_URI}/${dbName}`;
      const connection = await mongoose.createConnection(dbUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      dbConnections[dbName] = connection;
      console.log(
        `✅ Connected to database: ${dbName} (subdomain: ${subdomain})`
      );
    }

    // Attach database connection to request object
    req.db = dbConnections[dbName];
    req.dbName = dbName;
    req.subdomain = subdomain;

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

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 MongoDB base URI: ${MONGODB_BASE_URI}`);
  console.log(
    `🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:8002"}`
  );
  console.log(`\n📝 Available subdomains:`);
  Object.entries(subdomainToDb).forEach(([subdomain, db]) => {
    console.log(`   ${subdomain} -> ${db}`);
  });
  console.log(`\n✨ Test subdomain: test.anzaidev.fun -> webix-test database`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   POST /api2/seed - Seed test data`);
  console.log(`   GET  /api2/test-separation - Test database separation`);
  console.log(`   GET  /api2/collection/:name - Get collection data`);
  console.log(`   POST /api2/collection/:name/insert - Insert test data`);
  console.log(`   GET  /api2/db-stats - Database statistics`);
});
