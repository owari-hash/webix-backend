const express = require("express");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

// @route   GET /api2/notifications
// @desc    Get user notifications
// @access  Private
router.get("/", authenticate, async (req, res) => {
  try {
    const { limit = 50, skip = 0, unread_only = false } = req.query;
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const tenantDb = req.db;
    const notifications = [];

    // 1. Get notifications from database
    const notificationsCollection = tenantDb.db.collection("notifications");
    const mongoose = require("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    // Convert userId to ObjectId for query
    const userIdObj = new ObjectId(userId);

    const query = {
      user_id: userIdObj,
      subdomain: subdomain,
    };

    if (unread_only === "true") {
      query.is_read = false;
    }

    const dbNotifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();

    // Format database notifications
    dbNotifications.forEach((notif) => {
      notifications.push({
        id: notif._id.toString(),
        type: notif.type,
        title: notif.title,
        message: notif.message,
        is_read: notif.is_read || false,
        createdAt: notif.createdAt,
        metadata: notif.metadata || {},
        action: notif.metadata?.action || null,
      });
    });

    // 2. Add system notifications (License Expiration - Admin only)
    if (req.user.role === "admin") {
      const organizationCollection = req.centralDb.collection("Organization");

      const organization = await organizationCollection.findOne(
        { subdomain },
        { projection: { subscription: 1 } }
      );

      if (organization && organization.subscription) {
        const { endDate, status } = organization.subscription;

        if (endDate) {
          const end = new Date(endDate);
          const now = new Date();
          const diffTime = end.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Alert if expiring within 7 days or already expired
          if (diffDays <= 7) {
            notifications.push({
              id: "license-expiry",
              type: "system",
              title:
                diffDays < 0
                  ? "Лиценз дууссан байна!"
                  : "Лиценз дуусахад дөхөж байна",
              message:
                diffDays < 0
                  ? "Таны лицензийн хугацаа дууссан байна. Сунгалт хийнэ үү."
                  : `Таны лиценз ${diffDays} хоногийн дараа дуусна.`,
              createdAt: new Date(),
              is_read: false,
              action: "/cms/settings/billing",
            });
          }
        }
      }
    }

    // Sort by createdAt (newest first)
    notifications.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    // Get unread count
    const unreadCount = await notificationsCollection.countDocuments({
      user_id: userIdObj,
      subdomain: subdomain,
      is_read: false,
    });

    res.json({
      success: true,
      data: {
        notifications: notifications.slice(0, parseInt(limit)),
        total: notifications.length,
        unread_count: unreadCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: error.message,
    });
  }
});

// @route   PUT /api2/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put("/:id/read", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const tenantDb = req.db;
    const mongoose = require("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    const notificationsCollection = tenantDb.db.collection("notifications");

    // System notifications (like license-expiry) can't be marked as read
    if (id === "license-expiry") {
      return res.json({
        success: true,
        message: "System notification",
      });
    }

    const userIdObj = new ObjectId(userId);

    const result = await notificationsCollection.updateOne(
      {
        _id: new ObjectId(id),
        user_id: userIdObj,
        subdomain: req.subdomain,
      },
      {
        $set: {
          is_read: true,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
    });
  }
});

// @route   PUT /api2/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put("/read-all", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantDb = req.db;

    const notificationsCollection = tenantDb.db.collection("notifications");

    const userIdObj = new ObjectId(userId);

    const result = await notificationsCollection.updateMany(
      {
        user_id: userIdObj,
        subdomain: req.subdomain,
        is_read: false,
      },
      {
        $set: {
          is_read: true,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updated_count: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark all notifications as read",
    });
  }
});

module.exports = router;
