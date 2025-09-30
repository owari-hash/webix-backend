import express from "express";
import { AnalyticsService } from "../services/AnalyticsService";
import {
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware,
} from "../middleware";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const analyticsService = new AnalyticsService();

// Get dashboard metrics
router.get(
  "/:organizationId/dashboard",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["analytics:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const metrics = await analyticsService.getDashboardMetrics(
      req.params.organizationId,
      dateRange
    );

    res.json({
      success: true,
      data: metrics,
    });
  })
);

// Get webtoon analytics
router.get(
  "/:organizationId/webtoons/:webtoonId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["analytics:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange =
      startDate && endDate
        ? {
            start: new Date(startDate as string),
            end: new Date(endDate as string),
          }
        : undefined;

    const analytics = await analyticsService.getWebtoonAnalytics(
      req.params.webtoonId,
      dateRange
    );

    res.json({
      success: true,
      data: analytics,
    });
  })
);

// Get user activity
router.get(
  "/:organizationId/users/:userId/activity",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["analytics:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const activity = await analyticsService.getUserActivity(
      req.params.userId,
      dateRange
    );

    res.json({
      success: true,
      data: activity,
    });
  })
);

// Get organization growth
router.get(
  "/:organizationId/growth",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["analytics:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const growth = await analyticsService.getOrganizationGrowth(
      req.params.organizationId,
      dateRange
    );

    res.json({
      success: true,
      data: growth,
    });
  })
);

// Get content performance
router.get(
  "/:organizationId/content-performance",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["analytics:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const performance = await analyticsService.getContentPerformance(
      req.params.organizationId,
      dateRange
    );

    res.json({
      success: true,
      data: performance,
    });
  })
);

// Get revenue analytics
router.get(
  "/:organizationId/revenue",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["analytics:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const revenue = await analyticsService.getRevenueAnalytics(
      req.params.organizationId,
      dateRange
    );

    res.json({
      success: true,
      data: revenue,
    });
  })
);

// Get system performance
router.get(
  "/system-performance",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const performance = await analyticsService.getSystemPerformance(dateRange);

    res.json({
      success: true,
      data: performance,
    });
  })
);

// Track custom metric
router.post(
  "/track",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const {
      organizationId,
      userId,
      webtoonId,
      metricType,
      metricValue,
      metadata,
    } = req.body;

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
  })
);

export default router;
