import { DashboardMetrics, WebtoonAnalytics, DateRange } from "../types";
export declare class AnalyticsService {
    getDashboardMetrics(organizationId: string, dateRange: DateRange): Promise<DashboardMetrics>;
    getWebtoonAnalytics(webtoonId: string, dateRange?: DateRange): Promise<WebtoonAnalytics>;
    getUserActivity(userId: string, dateRange: DateRange): Promise<any[]>;
    getOrganizationGrowth(organizationId: string, dateRange: DateRange): Promise<any[]>;
    getContentPerformance(organizationId: string, dateRange: DateRange): Promise<any[]>;
    getRevenueAnalytics(organizationId: string, dateRange: DateRange): Promise<any[]>;
    trackMetric(data: {
        organizationId?: string;
        userId?: string;
        webtoonId?: string;
        metricType: string;
        metricValue: number;
        metadata?: any;
    }): Promise<void>;
    getSystemPerformance(dateRange: DateRange): Promise<any[]>;
}
//# sourceMappingURL=AnalyticsService.d.ts.map