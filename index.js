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

    // Default to 'udirdlaga' if no subdomain or if subdomain is 'localhost' or '127.0.0.1'
    let dbName = subdomainToDb[subdomain] || subdomainToDb["udirdlaga"];

    // If subdomain exists in mapping, use it; otherwise use subdomain as database name
    if (
      !subdomainToDb[subdomain] &&
      subdomain !== "localhost" &&
      subdomain !== "127.0.0.1"
    ) {
      // Allow dynamic subdomain to database mapping
      dbName = `webix-${subdomain}`;
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
      console.log(`✅ Connected to database: ${dbName}`);
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
app.get("/api/welcome", (req, res) => {
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
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    subdomain: req.subdomain,
    database: req.dbName,
    timestamp: new Date().toISOString(),
  });
});

// Test database connection endpoint
app.get("/api/test-db", async (req, res) => {
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
app.get("/api/collection/:collectionName", async (req, res) => {
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
app.get("/api/collection/:collectionName/:id", async (req, res) => {
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
app.get("/api/collection/:collectionName/search", async (req, res) => {
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
app.get("/api/db-stats", async (req, res) => {
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
  console.log(`✨ Welcome route: GET / or GET /api/welcome`);
});
