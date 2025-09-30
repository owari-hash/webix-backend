import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { CreateNotificationDto, PaginatedResponse } from "../types";
import { io } from "../index";

export class NotificationService {
  async createNotification(
    notificationData: CreateNotificationDto
  ): Promise<any> {
    const notification = await Notification.createNotification(
      notificationData
    );

    // Emit real-time notification
    io.to(`user:${notificationData.userId}`).emit(
      "notification:new",
      notification
    );

    // Log notification creation
    await AuditLog.logAction({
      userId: notificationData.userId,
      organizationId: notificationData.organizationId,
      action: "notification_created",
      resource: "notification",
      resourceId: notification._id,
    });

    return notification;
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false
  ): Promise<PaginatedResponse<any>> {
    const result = await Notification.getUserNotifications(
      userId,
      page,
      limit,
      unreadOnly
    );

    return {
      data: result.notifications,
      pagination: result.pagination,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<any> {
    const notification = await Notification.markAsRead(notificationId, userId);

    if (!notification) {
      throw new Error("Notification not found");
    }

    // Log notification read
    await AuditLog.logAction({
      userId,
      action: "notification_read",
      resource: "notification",
      resourceId: notificationId,
    });

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.markAllAsRead(userId);

    // Log all notifications read
    await AuditLog.logAction({
      userId,
      action: "all_notifications_read",
      resource: "notification",
      resourceId: "all",
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Notification.getUnreadCount(userId);
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });
    if (!notification) {
      throw new Error("Notification not found");
    }

    await Notification.findByIdAndDelete(notificationId);

    // Log notification deletion
    await AuditLog.logAction({
      userId,
      action: "notification_deleted",
      resource: "notification",
      resourceId: notificationId,
    });
  }

  async sendBulkNotification(
    userIds: string[],
    notificationData: Omit<CreateNotificationDto, "userId">
  ): Promise<any[]> {
    const notifications = [];

    for (const userId of userIds) {
      const notification = await this.createNotification({
        ...notificationData,
        userId,
      });
      notifications.push(notification);
    }

    return notifications;
  }

  async sendOrganizationNotification(
    organizationId: string,
    notificationData: Omit<CreateNotificationDto, "userId" | "organizationId">
  ): Promise<any[]> {
    // Get all users in the organization
    const { UserOrganization } = await import("../models/UserOrganization");
    const userOrgs = await UserOrganization.find({
      organizationId,
      isActive: true,
    });
    const userIds = userOrgs.map((org) => org.userId.toString());

    return this.sendBulkNotification(userIds, {
      ...notificationData,
      organizationId,
    });
  }

  async cleanupOldNotifications(daysOld = 30): Promise<number> {
    const result = await Notification.deleteOldNotifications(daysOld);
    return result.deletedCount || 0;
  }

  async getNotificationStats(userId: string): Promise<any> {
    const total = await Notification.countDocuments({ userId });
    const unread = await Notification.getUnreadCount(userId);
    const read = total - unread;

    return {
      total,
      read,
      unread,
      readPercentage: total > 0 ? Math.round((read / total) * 100) : 0,
    };
  }
}
