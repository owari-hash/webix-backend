import { Analytics } from "../models/Analytics";
import { Webtoon } from "../models/Webtoon";
import { User } from "../models/User";
import { DashboardMetrics, WebtoonAnalytics, DateRange } from "../types";

export class AnalyticsService {
  async getDashboardMetrics(
    organizationId: string,
    dateRange: DateRange
  ): Promise<DashboardMetrics> {
    const metrics = await Analytics.getDashboardMetrics(
      organizationId,
      dateRange.start,
      dateRange.end
    );

    return {
      totalUsers: metrics.user_registration?.total || 0,
      totalWebtoons: metrics.content_views?.total || 0,
      totalViews: metrics.webtoon_views?.total || 0,
      revenue: metrics.revenue?.total || 0,
    };
  }

  async getWebtoonAnalytics(
    webtoonId: string,
    dateRange?: DateRange
  ): Promise<WebtoonAnalytics> {
    const startDate =
      dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = dateRange?.end || new Date();

    return Analytics.getWebtoonAnalytics(webtoonId, startDate, endDate);
  }

  async getUserActivity(userId: string, dateRange: DateRange): Promise<any[]> {
    return Analytics.getUserActivity(userId, dateRange.start, dateRange.end);
  }

  async getOrganizationGrowth(
    organizationId: string,
    dateRange: DateRange
  ): Promise<any[]> {
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

    return Analytics.aggregate(pipeline);
  }

  async getContentPerformance(
    organizationId: string,
    dateRange: DateRange
  ): Promise<any[]> {
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

    return Analytics.aggregate(pipeline);
  }

  async getRevenueAnalytics(
    organizationId: string,
    dateRange: DateRange
  ): Promise<any[]> {
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
    await Analytics.trackMetric(data);
  }

  async getSystemPerformance(dateRange: DateRange): Promise<any[]> {
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

    return Analytics.aggregate(pipeline);
  }
}
