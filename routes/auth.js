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
