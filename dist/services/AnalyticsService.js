"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const Analytics_1 = require("../models/Analytics");
class AnalyticsService {
    async getDashboardMetrics(organizationId, dateRange) {
        const metrics = await Analytics_1.Analytics.getDashboardMetrics(organizationId, dateRange.start, dateRange.end);
        return {
            totalUsers: metrics.user_registration?.total || 0,
            totalWebtoons: metrics.content_views?.total || 0,
            totalViews: metrics.webtoon_views?.total || 0,
            revenue: metrics.revenue?.total || 0,
        };
    }
    async getWebtoonAnalytics(webtoonId, dateRange) {
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const endDate = dateRange?.end || new Date();
        return Analytics_1.Analytics.getWebtoonAnalytics(webtoonId, startDate, endDate);
    }
    async getUserActivity(userId, dateRange) {
        return Analytics_1.Analytics.getUserActivity(userId, dateRange.start, dateRange.end);
    }
    async getOrganizationGrowth(organizationId, dateRange) {
        const pipeline = [
            {
                $match: {
                    organizationId: organizationId,
                    metricType: "organization_growth",
                    date: { $gte: dateRange.start, $lte: dateRange.end },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        month: { $month: "$date" },
                        day: { $dayOfMonth: "$date" },
                    },
                    totalGrowth: { $sum: "$metricValue" },
                },
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
            },
        ];
        return Analytics_1.Analytics.aggregate(pipeline);
    }
    async getContentPerformance(organizationId, dateRange) {
        const pipeline = [
            {
                $match: {
                    organizationId: organizationId,
                    metricType: "webtoon_views",
                    date: { $gte: dateRange.start, $lte: dateRange.end },
                },
            },
            {
                $group: {
                    _id: "$webtoonId",
                    totalViews: { $sum: "$metricValue" },
                    uniqueViewers: { $addToSet: "$userId" },
                },
            },
            {
                $lookup: {
                    from: "webtoons",
                    localField: "_id",
                    foreignField: "_id",
                    as: "webtoon",
                },
            },
            {
                $unwind: "$webtoon",
            },
            {
                $project: {
                    webtoonId: "$_id",
                    title: "$webtoon.title",
                    totalViews: 1,
                    uniqueViewers: { $size: "$uniqueViewers" },
                },
            },
            {
                $sort: { totalViews: -1 },
            },
        ];
        return Analytics_1.Analytics.aggregate(pipeline);
    }
    async getRevenueAnalytics(organizationId, dateRange) {
        const pipeline = [
            {
                $match: {
                    organizationId: organizationId,
                    metricType: "revenue",
                    date: { $gte: dateRange.start, $lte: dateRange.end },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        month: { $month: "$date" },
                        day: { $dayOfMonth: "$date" },
                    },
                    totalRevenue: { $sum: "$metricValue" },
                    averageRevenue: { $avg: "$metricValue" },
                },
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
            },
        ];
        return Analytics_1.Analytics.aggregate(pipeline);
    }
    async trackMetric(data) {
        await Analytics_1.Analytics.trackMetric(data);
    }
    async getSystemPerformance(dateRange) {
        const pipeline = [
            {
                $match: {
                    metricType: "system_performance",
                    date: { $gte: dateRange.start, $lte: dateRange.end },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        month: { $month: "$date" },
                        day: { $dayOfMonth: "$date" },
                        hour: { $hour: "$date" },
                    },
                    averageResponseTime: { $avg: "$metricValue" },
                    maxResponseTime: { $max: "$metricValue" },
                    minResponseTime: { $min: "$metricValue" },
                },
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 },
            },
        ];
        return Analytics_1.Analytics.aggregate(pipeline);
    }
}
exports.AnalyticsService = AnalyticsService;
