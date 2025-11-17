const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api2/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const collection = req.db.collection("users");

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";
    if (req.query.premium !== undefined)
      filter.premium = req.query.premium === "true";

    const users = await collection
      .find(filter, { projection: { password: 0 } })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get users",
      error: error.message,
    });
  }
});

// @route   GET /api2/users/:id
// @desc    Get user by ID
// @access  Private
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const collection = req.db.collection("users");

    const user = await collection.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Users can only view their own profile unless they're admin
    if (req.user.userId !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: user,
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

// @route   POST /api2/users
// @desc    Create new user (Admin only)
// @access  Private/Admin
router.post("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");
    const { name, email, password, role, premium, isActive } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const collection = req.db.collection("users");

    // Check if user already exists
    const existingUser = await collection.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "user",
      premium: premium || false,
      isActive: isActive !== undefined ? isActive : true,
      subdomain: req.subdomain,
      database: req.dbName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newUser);

    // Remove password from response
    delete newUser.password;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: result.insertedId,
        ...newUser,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
});

// @route   PUT /api2/users/:id
// @desc    Update user
// @access  Private
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const bcrypt = require("bcryptjs");
    const collection = req.db.collection("users");

    // Users can only update their own profile unless they're admin
    if (req.user.userId !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { name, email, password, role, premium, isActive } = req.body;

    const updateFields = { updatedAt: new Date() };

    // Regular users cannot change their own role or premium status
    if (req.user.role === "admin") {
      if (role) updateFields.role = role;
      if (premium !== undefined) updateFields.premium = premium;
      if (isActive !== undefined) updateFields.isActive = isActive;
    }

    // All users can update these fields
    if (name) updateFields.name = name;
    if (email) updateFields.email = email.toLowerCase();

    // Hash new password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(password, salt);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
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
      message: "User updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
});

// @route   PATCH /api2/users/:id/premium
// @desc    Toggle premium status (Admin only)
// @access  Private/Admin
router.patch(
  "/:id/premium",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { ObjectId } = require("mongodb");
      const collection = req.db.collection("users");

      const { premium } = req.body;

      if (premium === undefined) {
        return res.status(400).json({
          success: false,
          message: "Premium status is required",
        });
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { premium, updatedAt: new Date() } },
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
        message: `Premium status ${premium ? "enabled" : "disabled"}`,
        data: result,
      });
    } catch (error) {
      console.error("Toggle premium error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle premium status",
        error: error.message,
      });
    }
  }
);

// @route   DELETE /api2/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const collection = req.db.collection("users");

    // Prevent deleting yourself
    if (req.user.userId === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const result = await collection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

module.exports = router;
