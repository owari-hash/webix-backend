const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// JWT Secret (should be in environment variables)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// @route   POST /api2/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, avatar } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Get subdomain and database from request
    const subdomain = req.subdomain;
    const database = req.dbName;

    // Check if user already exists in this subdomain
    const User = req.db.model("User", require("../models/User").schema);
    const existingUser = await User.findOne({ email, subdomain });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email in this subdomain",
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role || "user",
      subdomain,
      database,
      avatar: avatar || null,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        subdomain: user.subdomain,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subdomain: user.subdomain,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

// @route   POST /api2/auth/check-email
// @desc    Check which organizations a user belongs to by email
// @access  Public
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const mongoose = require("mongoose");
    const MONGODB_BASE_URI =
      process.env.MONGODB_URI || "mongodb://localhost:27017";

    // Get all databases that start with webix_ or webix-
    let adminConn;
    try {
      adminConn = await mongoose.createConnection(`${MONGODB_BASE_URI}/admin`);
      const client = adminConn.getClient();
      const adminDb = client.db("admin");
      const dbListResult = await adminDb.admin().listDatabases();

      const webixDbs = dbListResult.databases
        .filter(
          (db) => db.name.startsWith("webix_") || db.name.startsWith("webix-")
        )
        .map((db) => db.name);

      const organizations = [];

      // Connect to central database once for organization lookups
      const centralDbName = process.env.CENTRAL_DB_NAME || "webix-udirdlaga";
      let centralConn;
      try {
        centralConn = await mongoose.createConnection(
          `${MONGODB_BASE_URI}/${centralDbName}`
        );
      } catch (err) {
        console.error("Failed to connect to central database:", err.message);
      }

      // Check each database for the user
      for (const dbName of webixDbs) {
        try {
          const dbConn = await mongoose.createConnection(
            `${MONGODB_BASE_URI}/${dbName}`
          );

          // Try both collection names
          let user = await dbConn.collection("User").findOne({
            email: {
              $regex: new RegExp(
                `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                "i"
              ),
            },
          });

          if (!user) {
            user = await dbConn.collection("users").findOne({
              email: {
                $regex: new RegExp(
                  `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                  "i"
                ),
              },
            });
          }

          if (user) {
            // Extract subdomain from database name
            const subdomain = dbName.replace(/^webix[_-]/, "");

            // Get organization info from central database
            if (centralConn) {
              try {
                const org = await centralConn
                  .collection("Organization")
                  .findOne({ subdomain });

                if (org) {
                  organizations.push({
                    subdomain: subdomain,
                    name: org.name || subdomain,
                    displayName: org.displayName || org.name || subdomain,
                    logo: org.logo || null,
                  });
                } else {
                  // If org not found in central DB, still include it
                  organizations.push({
                    subdomain: subdomain,
                    name: subdomain,
                    displayName: subdomain,
                    logo: null,
                  });
                }
              } catch (err) {
                // If can't get org info, still include the subdomain
                organizations.push({
                  subdomain: subdomain,
                  name: subdomain,
                  displayName: subdomain,
                  logo: null,
                });
              }
            } else {
              // If central DB connection failed, still include the subdomain
              organizations.push({
                subdomain: subdomain,
                name: subdomain,
                displayName: subdomain,
                logo: null,
              });
            }
          }

          await dbConn.close();
        } catch (err) {
          console.error(`Error checking database ${dbName}:`, err.message);
          // Continue to next database
        }
      }

      // Close central database connection
      if (centralConn) {
        await centralConn.close();
      }

      await adminConn.close();

      if (organizations.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email",
        });
      }

      res.status(200).json({
        success: true,
        email: email,
        organizations: organizations,
        count: organizations.length,
      });
    } catch (error) {
      if (adminConn) await adminConn.close();
      throw error;
    }
  } catch (error) {
    console.error("Check email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check email",
      error: error.message,
    });
  }
});

// @route   POST /api2/auth/login
// @desc    Login user (supports both old and new User schema)
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
      username,
      subdomain: requestedSubdomain,
    } = req.body;

    // Validation
    if ((!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/username and password",
      });
    }

    // Get subdomain from request body (for multi-org login) or from request header
    const subdomain = requestedSubdomain || req.subdomain;

    // Helper function to escape regex special characters
    const escapeRegex = (str) => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    // Build query - support both email and username
    const query = {};
    if (email) {
      // Escape special regex characters and use case-insensitive search
      const escapedEmail = escapeRegex(email);
      query.email = { $regex: new RegExp(`^${escapedEmail}$`, "i") };
    } else if (username) {
      const escapedUsername = escapeRegex(username);
      query.username = { $regex: new RegExp(`^${escapedUsername}$`, "i") };
    }

    // Try to find user in both collections (User and users)
    let user = null;
    let collection = null;

    // First try "User" collection
    const UserCollection = req.db.collection("User");
    user = await UserCollection.findOne(query);

    if (user) {
      collection = UserCollection;
    } else {
      // If not found, try "users" collection
      const usersCollection = req.db.collection("users");
      user = await usersCollection.findOne(query);
      if (user) {
        collection = usersCollection;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials - user not found",
      });
    }

    // Check subdomain if user has subdomain field
    if (user.subdomain && user.subdomain !== subdomain) {
      return res.status(401).json({
        success: false,
        message: "User not found for this subdomain",
      });
    }

    // If user doesn't have subdomain field but we're checking a specific subdomain,
    // ensure the user exists in the correct database context
    if (
      !user.subdomain &&
      requestedSubdomain &&
      user.subdomain !== requestedSubdomain
    ) {
      return res.status(401).json({
        success: false,
        message: "User not found for this organization",
      });
    }

    // Check if user is active (support both 'status' and 'isActive' fields)
    if (user.status === "inactive" || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Please contact support.",
      });
    }

    // Check password using bcrypt
    const bcrypt = require("bcryptjs");
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials - wrong password",
      });
    }

    // Update last login/activity
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLogin: new Date(),
          "stats.lastActivity": new Date(),
        },
      }
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        subdomain: subdomain,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.firstName ? `${user.firstName} ${user.lastName}` : user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        subdomain: subdomain,
        avatar: user.avatar,
        lastLogin: new Date(),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

// @route   GET /api2/auth/me
// @desc    Get current user
// @access  Private (requires auth middleware)
router.get("/me", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const userId = new ObjectId(req.user.userId);

    // Get user from DB
    let collection = req.db.collection("users");
    let user = await collection.findOne({ _id: userId });

    if (!user) {
      collection = req.db.collection("User");
      user = await collection.findOne({ _id: userId });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.firstName ? `${user.firstName} ${user.lastName}` : user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        subdomain: req.subdomain,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: error.message,
    });
  }
});

// @route   POST /api2/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Public
router.post("/logout", async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logout successful",
      hint: "Remove token from client storage",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
});

// @route   PATCH /api2/auth/profile
// @desc    Update current user profile
// @access  Private
router.patch("/profile", authenticate, async (req, res) => {
  try {
    const { name, email, avatar, password } = req.body;
    const { ObjectId } = require("mongodb");
    const bcrypt = require("bcryptjs");

    // Try both collection names for compatibility
    const userId = new ObjectId(req.user.userId);
    let collection = req.db.collection("users");
    let user = await collection.findOne({ _id: userId });

    // If not found in "users", try "User" (capital U)
    if (!user) {
      collection = req.db.collection("User");
      user = await collection.findOne({ _id: userId });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateFields = { updatedAt: new Date() };

    // Update name if provided
    if (name) {
      updateFields.name = name;
    }

    // Update email if provided (check for duplicates)
    if (email) {
      const emailLower = email.toLowerCase();
      if (emailLower !== user.email) {
        const existingUser = await collection.findOne({
          email: emailLower,
          _id: { $ne: userId },
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Email already exists",
          });
        }
        updateFields.email = emailLower;
      }
    }

    // Update avatar if provided
    if (avatar !== undefined) {
      updateFields.avatar = avatar;
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(password, salt);
    }

    // Update user
    const result = await collection.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { returnDocument: "after", projection: { password: 0 } }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
});

module.exports = router;
