const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const Feedback = require("../models/Feedback");
const { notifyAdmins, notifyUser } = require("../utils/notifications");

const router = express.Router();

// ==================== FEEDBACK ENDPOINTS ====================

/**
 * @route   POST /api2/feedback
 * @desc    Create feedback (санал хүсэл гомдол)
 * @access  Private (Authenticated users)
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const { type, title, content, attachments, tags, priority } = req.body;
    const subdomain = req.subdomain;
    const tenantDb = req.db;
    const centralDb = req.centralDb;

    // Validate required fields
    if (!type || !title || !content) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: type, title, content",
      });
    }

    // Validate type
    const validTypes = ["санал", "хүсэл", "гомдол"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Get user information
    const userId = req.user.userId;
    let user = null;

    try {
      const usersCollection = tenantDb.db.collection("users");
      const mongoose = require("mongoose");
      const ObjectId = mongoose.Types.ObjectId;
      user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        const UserCollection = tenantDb.db.collection("User");
        user = await UserCollection.findOne({ _id: new ObjectId(userId) });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }

    // Get organization info
    const organizationCollection = centralDb.collection("Organization");
    const organization = await organizationCollection.findOne({ subdomain });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Create feedback document
    const FeedbackModel = tenantDb.model("Feedback", Feedback);
    const feedback = new FeedbackModel({
      type,
      title: title.trim(),
      content: content.trim(),
      user_id: userId,
      user_name:
        user?.name || user?.firstName || req.user.email || "Unknown User",
      user_email: user?.email || req.user.email || null,
      organization_subdomain: subdomain,
      status: "pending",
      priority: priority || "medium",
      attachments: attachments || [],
      tags: tags || [],
      subdomain: subdomain,
      database: req.dbName,
    });

    await feedback.save();

    // Notify all admin users about new feedback
    try {
      const typeNames = {
        санал: "Санал",
        хүсэл: "Хүсэл",
        гомдол: "Гомдол",
      };
      const typeName = typeNames[type] || type;

      await notifyAdmins({
        tenantDb,
        subdomain,
        type: "feedback_new",
        title: `Шинэ ${typeName}: ${title}`,
        message: `${
          user?.name || user?.firstName || "Хэрэглэгч"
        } шинэ ${typeName} илгээлээ: ${title}`,
        metadata: {
          feedback_id: feedback._id.toString(),
          feedback_type: type,
          user_id: userId,
          user_name: feedback.user_name,
          action: `/cms/feedback/${feedback._id}`,
        },
      });
    } catch (notifyError) {
      console.error("Failed to notify admins:", notifyError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Create feedback error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create feedback",
    });
  }
});

/**
 * @route   GET /api2/feedback
 * @desc    Get all feedback for organization (with filters)
 * @access  Private (Admin only)
 */
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const {
      type,
      status,
      priority,
      limit = 50,
      skip = 0,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    const tenantDb = req.db;
    const FeedbackModel = tenantDb.model("Feedback", Feedback);

    // Build query
    const query = {
      subdomain: req.subdomain,
      is_deleted: false,
    };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    // Build sort
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj = { [sort]: sortOrder };

    // Get feedback
    const feedbacks = await FeedbackModel.find(query)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await FeedbackModel.countDocuments(query);

    res.json({
      success: true,
      message: "Feedback retrieved successfully",
      data: {
        feedbacks,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get feedback",
    });
  }
});

/**
 * @route   GET /api2/feedback/my
 * @desc    Get current user's feedback
 * @access  Private (Authenticated users)
 */
router.get("/my", authenticate, async (req, res) => {
  try {
    const { type, status, limit = 50, skip = 0 } = req.query;
    const tenantDb = req.db;
    const userId = req.user.userId;

    const FeedbackModel = tenantDb.model("Feedback", Feedback);

    const query = {
      user_id: userId,
      subdomain: req.subdomain,
      is_deleted: false,
    };

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    const feedbacks = await FeedbackModel.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await FeedbackModel.countDocuments(query);

    res.json({
      success: true,
      message: "Your feedback retrieved successfully",
      data: {
        feedbacks,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Get my feedback error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get feedback",
    });
  }
});

/**
 * @route   GET /api2/feedback/:id
 * @desc    Get feedback by ID
 * @access  Private (Authenticated users - own feedback or admin)
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantDb = req.db;
    const userId = req.user.userId;
    const isAdmin = req.user.role === "admin";

    const FeedbackModel = tenantDb.model("Feedback", Feedback);
    const mongoose = require("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    const feedback = await FeedbackModel.findOne({
      _id: new ObjectId(id),
      subdomain: req.subdomain,
      is_deleted: false,
    }).lean();

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    // Check permissions: user can only view their own feedback unless admin
    if (!isAdmin && feedback.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Increment views
    await FeedbackModel.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { views: 1 } }
    );

    res.json({
      success: true,
      message: "Feedback retrieved successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get feedback",
    });
  }
});

/**
 * @route   PUT /api2/feedback/:id/respond
 * @desc    Respond to feedback (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id/respond",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { response, status: newStatus } = req.body;
      const tenantDb = req.db;
      const userId = req.user.userId;

      if (!response) {
        return res.status(400).json({
          success: false,
          message: "Response is required",
        });
      }

      const FeedbackModel = tenantDb.model("Feedback", Feedback);
      const mongoose = require("mongoose");
      const ObjectId = mongoose.Types.ObjectId;

      const feedback = await FeedbackModel.findById(new ObjectId(id));

      if (!feedback || feedback.subdomain !== req.subdomain) {
        return res.status(404).json({
          success: false,
          message: "Feedback not found",
        });
      }

      // Update feedback
      feedback.response = response;
      feedback.responded_by = userId;
      feedback.responded_at = new Date();

      if (newStatus) {
        const validStatuses = ["pending", "in_progress", "resolved", "closed"];
        if (validStatuses.includes(newStatus)) {
          feedback.status = newStatus;
        }
      } else {
        // Auto-set to resolved if responding
        if (feedback.status === "pending") {
          feedback.status = "resolved";
        }
      }

      await feedback.save();

      // Notify the user who submitted the feedback
      try {
        const typeNames = {
          санал: "Санал",
          хүсэл: "Хүсэл",
          гомдол: "Гомдол",
        };
        const typeName = typeNames[feedback.type] || feedback.type;

        await notifyUser({
          tenantDb,
          userId: feedback.user_id, // Pass ObjectId directly
          subdomain: req.subdomain,
          type: "feedback_response",
          title: `Таны ${typeName}д хариу өгөгдлөө`,
          message: `Таны "${feedback.title}" ${typeName}д админ хариу өгсөн байна.`,
          metadata: {
            feedback_id: feedback._id.toString(),
            feedback_type: feedback.type,
            responded_by: userId,
            action: `/cms/feedback/${feedback._id}`,
          },
        });
      } catch (notifyError) {
        console.error("Failed to notify user:", notifyError);
        // Don't fail the request if notification fails
      }

      res.json({
        success: true,
        message: "Response added successfully",
        data: feedback,
      });
    } catch (error) {
      console.error("Respond to feedback error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to respond to feedback",
      });
    }
  }
);

/**
 * @route   PUT /api2/feedback/:id/status
 * @desc    Update feedback status (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id/status",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, priority } = req.body;
      const tenantDb = req.db;

      const validStatuses = ["pending", "in_progress", "resolved", "closed"];
      const validPriorities = ["low", "medium", "high", "urgent"];

      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(
            ", "
          )}`,
        });
      }

      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Must be one of: ${validPriorities.join(
            ", "
          )}`,
        });
      }

      const FeedbackModel = tenantDb.model("Feedback", Feedback);
      const mongoose = require("mongoose");
      const ObjectId = mongoose.Types.ObjectId;

      const updateData = {};
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;

      const feedback = await FeedbackModel.findOneAndUpdate(
        {
          _id: new ObjectId(id),
          subdomain: req.subdomain,
          is_deleted: false,
        },
        { $set: updateData },
        { new: true }
      );

      if (!feedback) {
        return res.status(404).json({
          success: false,
          message: "Feedback not found",
        });
      }

      res.json({
        success: true,
        message: "Feedback status updated successfully",
        data: feedback,
      });
    } catch (error) {
      console.error("Update feedback status error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update feedback status",
      });
    }
  }
);

/**
 * @route   DELETE /api2/feedback/:id
 * @desc    Delete feedback (soft delete)
 * @access  Private (Admin or own feedback)
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantDb = req.db;
    const userId = req.user.userId;
    const isAdmin = req.user.role === "admin";

    const FeedbackModel = tenantDb.model("Feedback", Feedback);
    const mongoose = require("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    const feedback = await FeedbackModel.findOne({
      _id: new ObjectId(id),
      subdomain: req.subdomain,
      is_deleted: false,
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    // Check permissions
    if (!isAdmin && feedback.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Soft delete
    feedback.is_deleted = true;
    feedback.deleted_at = new Date();
    await feedback.save();

    res.json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    console.error("Delete feedback error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete feedback",
    });
  }
});

/**
 * @route   GET /api2/feedback/stats
 * @desc    Get feedback statistics (Admin only)
 * @access  Private (Admin)
 */
router.get("/stats", authenticate, authorize("admin"), async (req, res) => {
  try {
    const tenantDb = req.db;
    const FeedbackModel = tenantDb.model("Feedback", Feedback);

    const query = {
      subdomain: req.subdomain,
      is_deleted: false,
    };

    const [total, byType, byStatus, byPriority, pendingCount, resolvedCount] =
      await Promise.all([
        FeedbackModel.countDocuments(query),
        FeedbackModel.aggregate([
          { $match: query },
          { $group: { _id: "$type", count: { $sum: 1 } } },
        ]),
        FeedbackModel.aggregate([
          { $match: query },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        FeedbackModel.aggregate([
          { $match: query },
          { $group: { _id: "$priority", count: { $sum: 1 } } },
        ]),
        FeedbackModel.countDocuments({ ...query, status: "pending" }),
        FeedbackModel.countDocuments({ ...query, status: "resolved" }),
      ]);

    res.json({
      success: true,
      message: "Feedback statistics retrieved successfully",
      data: {
        total,
        pending: pendingCount,
        resolved: resolvedCount,
        by_type: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        by_status: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        by_priority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Get feedback stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get feedback statistics",
    });
  }
});

module.exports = router;
