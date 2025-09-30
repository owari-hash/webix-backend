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
exports.Analytics = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const AnalyticsSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "organization",
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        index: true,
    },
    webtoonId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "webtoon",
        index: true,
    },
    metricType: {
        type: String,
        enum: [
            "user_activity",
            "content_views",
            "organization_growth",
            "revenue",
            "system_performance",
            "webtoon_views",
            "user_registration",
            "login_attempts",
        ],
        required: true,
        index: true,
    },
    metricValue: {
        type: Number,
        required: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    date: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: true,
});
// Compound indexes for efficient queries
AnalyticsSchema.index({ organizationId: 1, metricType: 1, date: -1 });
AnalyticsSchema.index({ userId: 1, metricType: 1, date: -1 });
AnalyticsSchema.index({ webtoonId: 1, metricType: 1, date: -1 });
AnalyticsSchema.index({ metricType: 1, date: -1 });
// Static method to get dashboard metrics
AnalyticsSchema.statics.getDashboardMetrics = async function (organizationId, startDate, endDate) {
    const pipeline = [
        {
            $match: {
                organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
                date: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: "$metricType",
                total: { $sum: "$metricValue" },
                count: { $sum: 1 },
                average: { $avg: "$metricValue" },
                max: { $max: "$metricValue" },
                min: { $min: "$metricValue" },
            },
        },
    ];
    const metrics = await this.aggregate(pipeline);
    // Format the results
    const result = {};
    metrics.forEach((metric) => {
        result[metric._id] = {
            total: metric.total,
            count: metric.count,
            average: Math.round(metric.average * 100) / 100,
            max: metric.max,
            min: metric.min,
        };
    });
    return result;
};
// Static method to get webtoon analytics
AnalyticsSchema.statics.getWebtoonAnalytics = async function (webtoonId, startDate, endDate) {
    const matchQuery = { webtoonId: new mongoose_1.default.Types.ObjectId(webtoonId) };
    if (startDate && endDate) {
        matchQuery.date = { $gte: startDate, $lte: endDate };
    }
    const pipeline = [
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$metricValue" },
                uniqueViewers: { $addToSet: "$userId" },
                averageRating: { $avg: "$metadata.rating" },
                totalEpisodes: { $addToSet: "$metadata.episodeId" },
            },
        },
        {
            $project: {
                totalViews: 1,
                uniqueViewers: { $size: "$uniqueViewers" },
                averageRating: { $round: ["$averageRating", 2] },
                totalEpisodes: { $size: "$totalEpisodes" },
            },
        },
    ];
    const result = await this.aggregate(pipeline);
    return (result[0] || {
        totalViews: 0,
        uniqueViewers: 0,
        averageRating: 0,
        totalEpisodes: 0,
    });
};
// Static method to get user activity
AnalyticsSchema.statics.getUserActivity = async function (userId, startDate, endDate) {
    const pipeline = [
        {
            $match: {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                date: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: "$date" },
                    month: { $month: "$date" },
                    day: { $dayOfMonth: "$date" },
                },
                totalActivity: { $sum: "$metricValue" },
                activityTypes: { $addToSet: "$metricType" },
            },
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
        },
    ];
    return this.aggregate(pipeline);
};
// Static method to track metric
AnalyticsSchema.statics.trackMetric = async function (data) {
    const analytics = new this({
        ...data,
        date: new Date(),
    });
    return analytics.save();
};
exports.Analytics = mongoose_1.default.model("analytics", AnalyticsSchema);
