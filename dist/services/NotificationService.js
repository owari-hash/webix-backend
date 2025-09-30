"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const Notification_1 = require("../models/Notification");
const AuditLog_1 = require("../models/AuditLog");
const index_1 = require("../index");
class NotificationService {
    async createNotification(notificationData) {
        const notification = await Notification_1.Notification.createNotification(notificationData);
        // Emit real-time notification
        index_1.io.to(`user:${notificationData.userId}`).emit("notification:new", notification);
        // Log notification creation
        await AuditLog_1.AuditLog.logAction({
            userId: notificationData.userId,
            organizationId: notificationData.organizationId,
            action: "notification_created",
            resource: "notification",
            resourceId: notification._id,
        });
        return notification;
    }
    async getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
        const result = await Notification_1.Notification.getUserNotifications(userId, page, limit, unreadOnly);
        return {
            data: result.notifications,
            pagination: result.pagination,
        };
    }
    async markAsRead(notificationId, userId) {
        const notification = await Notification_1.Notification.markAsRead(notificationId, userId);
        if (!notification) {
            throw new Error("Notification not found");
        }
        // Log notification read
        await AuditLog_1.AuditLog.logAction({
            userId,
            action: "notification_read",
            resource: "notification",
            resourceId: notificationId,
        });
        return notification;
    }
    async markAllAsRead(userId) {
        await Notification_1.Notification.markAllAsRead(userId);
        // Log all notifications read
        await AuditLog_1.AuditLog.logAction({
            userId,
            action: "all_notifications_read",
            resource: "notification",
            resourceId: "all",
        });
    }
    async getUnreadCount(userId) {
        return Notification_1.Notification.getUnreadCount(userId);
    }
    async deleteNotification(notificationId, userId) {
        const notification = await Notification_1.Notification.findOne({
            _id: notificationId,
            userId,
        });
        if (!notification) {
            throw new Error("Notification not found");
        }
        await Notification_1.Notification.findByIdAndDelete(notificationId);
        // Log notification deletion
        await AuditLog_1.AuditLog.logAction({
            userId,
            action: "notification_deleted",
            resource: "notification",
            resourceId: notificationId,
        });
    }
    async sendBulkNotification(userIds, notificationData) {
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
    async sendOrganizationNotification(organizationId, notificationData) {
        // Get all users in the organization
        const { UserOrganization } = await Promise.resolve().then(() => __importStar(require("../models/UserOrganization")));
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
    async cleanupOldNotifications(daysOld = 30) {
        const result = await Notification_1.Notification.deleteOldNotifications(daysOld);
        return result.deletedCount || 0;
    }
    async getNotificationStats(userId) {
        const total = await Notification_1.Notification.countDocuments({ userId });
        const unread = await Notification_1.Notification.getUnreadCount(userId);
        const read = total - unread;
        return {
            total,
            read,
            unread,
            readPercentage: total > 0 ? Math.round((read / total) * 100) : 0,
        };
    }
}
exports.NotificationService = NotificationService;
