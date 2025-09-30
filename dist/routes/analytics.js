"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AnalyticsService_1 = require("../services/AnalyticsService");
const middleware_1 = require("../middleware");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const analyticsService = new AnalyticsService_1.AnalyticsService();
// Get dashboard metrics
router.get("/:organizationId/dashboard", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["analytics:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = {
        start: startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
    };
    const metrics = await analyticsService.getDashboardMetrics(req.params.organizationId, dateRange);
    res.json({
        success: true,
        data: metrics,
    });
}));
// Get webtoon analytics
router.get("/:organizationId/webtoons/:webtoonId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["analytics:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate
        ? {
            start: new Date(startDate),
            end: new Date(endDate),
        }
        : undefined;
    const analytics = await analyticsService.getWebtoonAnalytics(req.params.webtoonId, dateRange);
    res.json({
        success: true,
        data: analytics,
    });
}));
// Get user activity
router.get("/:organizationId/users/:userId/activity", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["analytics:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = {
        start: startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
    };
    const activity = await analyticsService.getUserActivity(req.params.userId, dateRange);
    res.json({
        success: true,
        data: activity,
    });
}));
// Get organization growth
router.get("/:organizationId/growth", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["analytics:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = {
        start: startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
    };
    const growth = await analyticsService.getOrganizationGrowth(req.params.organizationId, dateRange);
    res.json({
        success: true,
        data: growth,
    });
}));
// Get content performance
router.get("/:organizationId/content-performance", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["analytics:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = {
        start: startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
    };
    const performance = await analyticsService.getContentPerformance(req.params.organizationId, dateRange);
    res.json({
        success: true,
        data: performance,
    });
}));
// Get revenue analytics
router.get("/:organizationId/revenue", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["analytics:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = {
        start: startDate
            ? new Date(startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
    };
    const revenue = await analyticsService.getRevenueAnalytics(req.params.organizationId, dateRange);
    res.json({
        success: true,
        data: revenue,
    });
}));
// Get system performance
router.get("/system-performance", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateRange = {
        start: startDate
            ? new Date(startDate)
            : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
    };
    const performance = await analyticsService.getSystemPerformance(dateRange);
    res.json({
        success: true,
        data: performance,
    });
}));
// Track custom metric
router.post("/track", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { organizationId, userId, webtoonId, metricType, metricValue, metadata, } = req.body;
    await analyticsService.trackMetric({
        organizationId,
        userId,
        webtoonId,
        metricType,
        metricValue,
        metadata,
    });
    res.json({
        success: true,
        message: "Metric tracked successfully",
    });
}));
exports.default = router;
