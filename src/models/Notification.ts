import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface NotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  isRead: boolean;
  readAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });

// Static method to create notification
NotificationSchema.statics.createNotification = async function (data: {
  userId: string;
  organizationId?: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error" | "system";
}) {
  const notification = new this({
    ...data,
    type: data.type || "info",
  });

  return notification.save();
};

// Static method to get user notifications
NotificationSchema.statics.getUserNotifications = async function (
  userId: string,
  page = 1,
  limit = 20,
  unreadOnly = false
) {
  const query: any = { userId };
  if (unreadOnly) query.isRead = false;

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
NotificationSchema.statics.markAsRead = async function (
  notificationId: string,
  userId: string
) {
  return this.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

// Static method to mark all as read
NotificationSchema.statics.markAllAsRead = async function (userId: string) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function (userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method to delete old notifications
NotificationSchema.statics.deleteOldNotifications = async function (
  daysOld = 30
) {
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

export const Notification = mongoose.model<NotificationDocument>(
  "notification",
  NotificationSchema
);
