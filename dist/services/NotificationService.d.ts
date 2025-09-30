import { CreateNotificationDto, PaginatedResponse } from "../types";
export declare class NotificationService {
    createNotification(notificationData: CreateNotificationDto): Promise<any>;
    getUserNotifications(userId: string, page?: number, limit?: number, unreadOnly?: boolean): Promise<PaginatedResponse<any>>;
    markAsRead(notificationId: string, userId: string): Promise<any>;
    markAllAsRead(userId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<number>;
    deleteNotification(notificationId: string, userId: string): Promise<void>;
    sendBulkNotification(userIds: string[], notificationData: Omit<CreateNotificationDto, "userId">): Promise<any[]>;
    sendOrganizationNotification(organizationId: string, notificationData: Omit<CreateNotificationDto, "userId" | "organizationId">): Promise<any[]>;
    cleanupOldNotifications(daysOld?: number): Promise<number>;
    getNotificationStats(userId: string): Promise<any>;
}
//# sourceMappingURL=NotificationService.d.ts.map