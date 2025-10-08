import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface AnalyticsDocument extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  webtoonId?: mongoose.Types.ObjectId;
  resourceType: string;
  resourceId: string;
  metricType: string;
  metricValue: number;
  metadata?: any;
  date: Date;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsSchema = new Schema<AnalyticsDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "organization",
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      index: true,
    },
    webtoonId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.Mixed,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
AnalyticsSchema.index({ organizationId: 1, metricType: 1, date: -1 });
AnalyticsSchema.index({ userId: 1, metricType: 1, date: -1 });
AnalyticsSchema.index({ webtoonId: 1, metricType: 1, date: -1 });
AnalyticsSchema.index({ metricType: 1, date: -1 });

// Static method to get dashboard metrics
AnalyticsSchema.statics.getDashboardMetrics = async function (
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
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
  const result: any = {};
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
AnalyticsSchema.statics.getWebtoonAnalytics = async function (
  webtoonId: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchQuery: any = { webtoonId: new mongoose.Types.ObjectId(webtoonId) };

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
  return (
    result[0] || {
      totalViews: 0,
      uniqueViewers: 0,
      averageRating: 0,
      totalEpisodes: 0,
    }
  );
};

// Static method to get user activity
AnalyticsSchema.statics.getUserActivity = async function (
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline: any[] = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate, $lte: endDate },
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

  return this.aggregate(pipeline);
};

// Static method to track metric
AnalyticsSchema.statics.trackMetric = async function (data: {
  organizationId?: string;
  userId?: string;
  webtoonId?: string;
  metricType: string;
  metricValue: number;
  metadata?: any;
}) {
  const analytics = new this({
    ...data,
    date: new Date(),
  });

  return analytics.save();
};

export const Analytics = mongoose.model<AnalyticsDocument>(
  "analytics",
  AnalyticsSchema
);
