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
exports.Notification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const NotificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "organization",
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ["info", "success", "warning", "error", "system"],
        default: "info",
        index: true,
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true,
    },
    readAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Indexes
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });
// Static method to create notification
NotificationSchema.statics.createNotification = async function (data) {
    const notification = new this({
        ...data,
        type: data.type || "info",
    });
    return notification.save();
};
// Static method to get user notifications
NotificationSchema.statics.getUserNotifications = async function (userId, page = 1, limit = 20, unreadOnly = false) {
    const query = { userId };
    if (unreadOnly)
        query.isRead = false;
    const skip = (page - 1) * limit;
    const notifications = await this.find(query)
        .populate("organizationId", "name subdomain")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await this.countDocuments(query);
    return {
        notifications,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};
// Static method to mark as read
NotificationSchema.statics.markAsRead = async function (notificationId, userId) {
    return this.findOneAndUpdate({ _id: notificationId, userId }, { isRead: true, readAt: new Date() }, { new: true });
};
// Static method to mark all as read
NotificationSchema.statics.markAllAsRead = async function (userId) {
    return this.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
};
// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ userId, isRead: false });
};
// Static method to delete old notifications
NotificationSchema.statics.deleteOldNotifications = async function (daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    return this.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true,
    });
};
// Instance method to mark as read
NotificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};
exports.Notification = mongoose_1.default.model("notification", NotificationSchema);
