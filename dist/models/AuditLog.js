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
exports.AuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const AuditLogSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.Mixed,
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
}, {
    timestamps: false, // We use custom timestamp field
});
// Indexes
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, resource: 1 });
AuditLogSchema.index({ timestamp: -1 });
// TTL index to automatically delete old logs (keep for 1 year)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });
// Static method to log action
AuditLogSchema.statics.logAction = async function (data) {
    const auditLog = new this({
        ...data,
        timestamp: new Date(),
    });
    return auditLog.save();
};
// Static method to get audit logs
AuditLogSchema.statics.getAuditLogs = async function (filters, page = 1, limit = 50) {
    const query = {};
    if (filters.userId)
        query.userId = new mongoose_1.default.Types.ObjectId(filters.userId);
    if (filters.organizationId)
        query.organizationId = new mongoose_1.default.Types.ObjectId(filters.organizationId);
    if (filters.action)
        query.action = filters.action;
    if (filters.resource)
        query.resource = filters.resource;
    if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate)
            query.timestamp.$gte = filters.startDate;
        if (filters.endDate)
            query.timestamp.$lte = filters.endDate;
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
AuditLogSchema.statics.getAuditStats = async function (organizationId, startDate, endDate) {
    const pipeline = [
        {
            $match: {
                organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
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
exports.AuditLog = mongoose_1.default.model("auditlog", AuditLogSchema);
