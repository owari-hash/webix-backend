import { PaginatedResponse } from "../types";
export declare class MessageService {
    sendMessage(data: {
        senderId: string;
        receiverId: string;
        organizationId?: string;
        content: string;
    }): Promise<any>;
    getConversation(user1Id: string, user2Id: string, page?: number, limit?: number): Promise<PaginatedResponse<any>>;
    getUserConversations(userId: string): Promise<any[]>;
    markAsRead(senderId: string, receiverId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<number>;
    deleteMessage(messageId: string, userId: string): Promise<void>;
    getMessageById(messageId: string, userId: string): Promise<any>;
    searchMessages(userId: string, searchTerm: string, page?: number, limit?: number): Promise<PaginatedResponse<any>>;
    getMessageStats(userId: string): Promise<any>;
}
//# sourceMappingURL=MessageService.d.ts.map