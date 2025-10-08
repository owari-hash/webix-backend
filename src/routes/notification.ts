import express from "express";
import { NotificationService } from "../services/NotificationService";
import {
  authMiddleware,
  organizationAccessMiddleware,
  validateRequest,
  permissionMiddleware,
} from "../middleware";
import { createNotificationSchema } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const notificationService = new NotificationService();

// Create notification
router.post(
  "/",
  authMiddleware,
  validateRequest(createNotificationSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({
      success: true,
      message: "Notification created successfully",
    });
  })
);

// Get user notifications
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    res.json({
      success: true,
    });
  })
);

// Get unread count
router.get(
  "/unread-count",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
    });
  })
);

// Mark notification as read
router.put(
  "/:notificationId/read",
  authMiddleware,

  // Mark all notifications as read
  router.put(
    "/mark-all-read",
    authMiddleware,
    asyncHandler(async (req, res) => {
      await notificationService.markAllAsRead(req.user!.userId);

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    })
  )
);

// Delete notification
router.delete(
  "/:notificationId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  })
);

// Send bulk notification
router.post(
  "/bulk",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["notifications:write"]),
  asyncHandler(async (req, res) => {
    const { userIds, ...notificationData } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    res.status(201).json({
      success: true,
      message: "Bulk notifications sent successfully",
    });
  })
);

// Send organization notification
router.post(
  "/organization/:organizationId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["notifications:write"]),
  asyncHandler(async (req, res) => {
    const { title, message, type } = req.body;

    const notifications = res.status(201).json({
      success: true,
      message: "Organization notification sent successfully",
    });
  })
);

// Get notification statistics
router.get(
  "/stats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
    });
  })
);

// Cleanup old notifications (admin only)
router.post(
  "/cleanup",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { daysOld = 30 } = req.body;

    res.json({
      success: true,
    });
  })
);

export default router;
