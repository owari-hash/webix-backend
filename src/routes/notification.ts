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
    const notification = await notificationService.createNotification(req.body);

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  })
);

// Get user notifications
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const result = await notificationService.getUserNotifications(
      req.user!.userId,
      Number(page),
      Number(limit),
      unreadOnly === "true"
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get unread count
router.get(
  "/unread-count",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.user!.userId);

    res.json({
      success: true,
      data: { count },
    });
  })
);

// Mark notification as read
router.put(
  "/:notificationId/read",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(
      req.params.notificationId,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  })
);

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
);

// Delete notification
router.delete(
  "/:notificationId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await notificationService.deleteNotification(
      req.params.notificationId,
      req.user!.userId
    );

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

    const notifications = await notificationService.sendBulkNotification(
      userIds,
      notificationData
    );

    res.status(201).json({
      success: true,
      message: "Bulk notifications sent successfully",
      data: notifications,
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

    const notifications =
      await notificationService.sendOrganizationNotification(
        req.params.organizationId,
        { title, message, type }
      );

    res.status(201).json({
      success: true,
      message: "Organization notification sent successfully",
      data: { sentCount: notifications.length },
    });
  })
);

// Get notification statistics
router.get(
  "/stats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const stats = await notificationService.getNotificationStats(
      req.user!.userId
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

// Cleanup old notifications (admin only)
router.post(
  "/cleanup",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { daysOld = 30 } = req.body;

    const deletedCount = await notificationService.cleanupOldNotifications(
      daysOld
    );

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old notifications`,
    });
  })
);

export default router;
