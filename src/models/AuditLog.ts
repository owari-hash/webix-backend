import mongoose, { Schema, Document } from "mongoose";
import { AuditLog as IAuditLog } from "../types";

mongoose.pluralize(null);

export interface AuditLogDocument extends IAuditLog, Document {}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "organization",
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resource: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use custom timestamp field
  }
);

// Indexes
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, resource: 1 });
AuditLogSchema.index({ timestamp: -1 });

// TTL index to automatically delete old logs (keep for 1 year)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

// Static method to log action
AuditLogSchema.statics.logAction = async function (data: {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  const auditLog = new this({
    ...data,
    timestamp: new Date(),
  });

  return auditLog.save();
};

// Static method to get audit logs
AuditLogSchema.statics.getAuditLogs = async function (
  filters: {
    userId?: string;
    organizationId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  },
  page = 1,
  limit = 50
) {
  const query: any = {};

  if (filters.userId)
    query.userId = new mongoose.Types.ObjectId(filters.userId);
  if (filters.organizationId)
    query.organizationId = new mongoose.Types.ObjectId(filters.organizationId);
  if (filters.action) query.action = filters.action;
  if (filters.resource) query.resource = filters.resource;

  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = filters.startDate;
    if (filters.endDate) query.timestamp.$lte = filters.endDate;
  }

  const skip = (page - 1) * limit;

  const logs = await this.find(query)
    .populate("userId", "displayName email")
    .populate("organizationId", "name subdomain")
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get audit statistics
AuditLogSchema.statics.getAuditStats = async function (
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          action: "$action",
          resource: "$resource",
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        action: "$_id.action",
        resource: "$_id.resource",
        count: 1,
        uniqueUsers: { $size: "$uniqueUsers" },
      },
    },
    {
      $sort: { count: -1 },
    },
  ];

  return this.aggregate(pipeline);
};

export const AuditLog = mongoose.model<AuditLogDocument>(
  "auditlog",
  AuditLogSchema
);
