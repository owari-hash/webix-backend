const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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
    const { name, email, password, role } = req.body;

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

// @route   POST /api2/auth/login
// @desc    Login user (supports both old and new User schema)
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Validation
    if ((!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/username and password",
      });
    }

    // Get subdomain from request
    const subdomain = req.subdomain;

    // Try to find user in the User collection (case-insensitive)
    const collection = req.db.collection("User");

    // Build query - support both email and username
    const query = {};
    if (email) {
      query.email = { $regex: new RegExp(`^${email}$`, "i") };
    } else if (username) {
      query.username = { $regex: new RegExp(`^${username}$`, "i") };
    }

    const user = await collection.findOne(query);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials - user not found",
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
router.get("/me", async (req, res) => {
  try {
    // This would require auth middleware to be implemented
    // For now, return a message
    res.status(200).json({
      success: true,
      message: "Get current user endpoint (requires authentication middleware)",
      hint: "Add Authorization: Bearer <token> header",
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

module.exports = router;
