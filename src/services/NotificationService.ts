import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { CreateNotificationDto, PaginatedResponse } from "../types";
import mongoose from "mongoose";

export class NotificationService {
  async createNotification(
    organizationId: string,
    notificationData: CreateNotificationDto
  ): Promise<any> {
    const notification = new Notification({
      ...notificationData,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: notificationData.userId
        ? new mongoose.Types.ObjectId(notificationData.userId)
        : undefined,
      isRead: false,
    });

    await notification.save();

    // Emit real-time notification

    // Log notification creation
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: notificationData.userId
        ? new mongoose.Types.ObjectId(notificationData.userId)
        : undefined,
      action: "notification_created",
      resource: "notification",
      resourceId: notification._id,
    });
    await auditLog.save();

    return notification;
  }

  async getNotifications(
    organizationId: string,
    userId?: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<any>> {
    const query: any = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    if (userId) {
      query.$or = [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: { $exists: false } },
      ];
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<any> {
    const notification = await Notification.findOne({
      _id: new mongoose.Types.ObjectId(notificationId),
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: { $exists: false } },
      ],
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    notification.isRead = true;
    await notification.save();

    // Log notification read
    const auditLog = new AuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "notification_read",
      resource: "notification",
      resourceId: new mongoose.Types.ObjectId(notificationId),
    });
    await auditLog.save();

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      {
        $or: [
          { userId: new mongoose.Types.ObjectId(userId) },
          { userId: { $exists: false } },
        ],
        isRead: false,
      },
      { isRead: true }
    );

    // Log all notifications read
    const auditLog = new AuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "all_notifications_read",
      resource: "notification",
      resourceId: "all",
    });
    await auditLog.save();
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const notification = await Notification.findOne({
      _id: new mongoose.Types.ObjectId(notificationId),
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: { $exists: false } },
      ],
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    await Notification.findByIdAndDelete(
      new mongoose.Types.ObjectId(notificationId)
    );

    // Log notification deletion
    const auditLog = new AuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "notification_deleted",
      resource: "notification",
      resourceId: new mongoose.Types.ObjectId(notificationId),
    });
    await auditLog.save();
  }

  async sendToMultipleUsers(
    organizationId: string,
    userIds: string[],
    notificationData: Omit<CreateNotificationDto, "userId">
  ): Promise<any[]> {
    const notifications = [];

    for (const userId of userIds) {
      const notification = await this.createNotification(organizationId, {
        ...notificationData,
        userId,
      });
      notifications.push(notification);
    }

    return notifications;
  }

  async sendToOrganization(
    organizationId: string,
    notificationData: Omit<CreateNotificationDto, "userId">
  ): Promise<any> {
    // Get all users in the organization
    const { UserOrganization } = await import("../models/UserOrganization");
    const userOrgs = await UserOrganization.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      isActive: true,
    });
    const userIds = userOrgs.map((org) => org.userId.toString());

    return this.sendToMultipleUsers(organizationId, userIds, {
      ...notificationData,
      organizationId,
    });
  }

  async cleanupOldNotifications(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }

  async getUnreadCount(
    userId: string,
    organizationId: string
  ): Promise<number> {
    return Notification.countDocuments({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { userId: { $exists: false } },
      ],
      isRead: false,
    });
  }
}
