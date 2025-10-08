import { Analytics } from "../models/Analytics";
import { Webtoon } from "../models/Webtoon";
import { User } from "../models/User";
import { DashboardMetrics, WebtoonAnalytics, DateRange } from "../types";
import mongoose from "mongoose";

export class AnalyticsService {
  async getDashboardMetrics(
    organizationId: string,
    dateRange: DateRange
  ): Promise<DashboardMetrics> {
    // Get user registrations
    const userRegistrations = await Analytics.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          metricType: "user_registration",
          date: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$metricValue" },
        },
      },
    ]);

    // Get content views
    const contentViews = await Analytics.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          metricType: "content_views",
          date: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$metricValue" },
        },
      },
    ]);

    // Get webtoon views
    const webtoonViews = await Analytics.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          metricType: "webtoon_views",
          date: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$metricValue" },
        },
      },
    ]);

    // Get revenue
    const revenue = await Analytics.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          metricType: "revenue",
          date: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$metricValue" },
        },
      },
    ]);

    return {
      totalUsers: userRegistrations[0]?.total || 0,
      totalWebtoons: contentViews[0]?.total || 0,
      totalViews: webtoonViews[0]?.total || 0,
      revenue: revenue[0]?.total || 0,
    };
  }

  async getWebtoonAnalytics(
    webtoonId: string,
    dateRange?: DateRange
  ): Promise<WebtoonAnalytics> {
    const startDate =
      dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = dateRange?.end || new Date();

    const pipeline: any[] = [
      {
        $match: {
          webtoonId: new mongoose.Types.ObjectId(webtoonId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$metricType",
          total: { $sum: "$metricValue" },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await Analytics.aggregate(pipeline);

    const analytics: any = {};
    results.forEach((result) => {
      analytics[result._id] = {
        total: result.total,
        count: result.count,
      };
    });

    return analytics;
  }

  async getUserActivity(userId: string, dateRange: DateRange): Promise<any[]> {
    const pipeline: any[] = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
          },
          totalActivity: { $sum: "$metricValue" },
          activityTypes: { $addToSet: "$metricType" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ];

    return Analytics.aggregate(pipeline);
  }

  async getOrganizationGrowth(
    organizationId: string,
    dateRange: DateRange
  ): Promise<any[]> {
    const pipeline: any[] = [
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
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

    return Analytics.aggregate(pipeline);
  }

  async getContentPerformance(
    organizationId: string,
    dateRange: DateRange
  ): Promise<any[]> {
    const pipeline: any[] = [
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
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

    return Analytics.aggregate(pipeline);
  }

  async getRevenueAnalytics(
    organizationId: string,
    dateRange: DateRange
  ): Promise<any[]> {
    const pipeline: any[] = [
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
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

    return Analytics.aggregate(pipeline);
  }

  async trackMetric(data: {
    organizationId?: string;
    userId?: string;
    webtoonId?: string;
    metricType: string;
    metricValue: number;
    metadata?: any;
  }): Promise<void> {
    const analytics = new Analytics({
      organizationId: data.organizationId
        ? new mongoose.Types.ObjectId(data.organizationId)
        : undefined,
      userId: data.userId
        ? new mongoose.Types.ObjectId(data.userId)
        : undefined,
      webtoonId: data.webtoonId
        ? new mongoose.Types.ObjectId(data.webtoonId)
        : undefined,
      resourceType: "analytics",
      resourceId: "metric",
      metricType: data.metricType,
      metricValue: data.metricValue,
      metadata: data.metadata,
      timestamp: new Date(),
      date: new Date(),
    });

    await analytics.save();
  }

  async getSystemPerformance(dateRange: DateRange): Promise<any[]> {
    const pipeline: any[] = [
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

    return Analytics.aggregate(pipeline);
  }
}
