import { Message } from "../models/Message";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { PaginatedResponse } from "../types";
import { io } from "../index";

export class MessageService {
  async sendMessage(data: {
    senderId: string;
    receiverId: string;
    organizationId?: string;
    content: string;
  }): Promise<any> {
    const message = await Message.sendMessage(data);

    // Emit real-time message
    io.to(`user:${data.receiverId}`).emit("new-message", message);

    // Log message sending
    await AuditLog.logAction({
      userId: data.senderId,
      organizationId: data.organizationId,
      action: "message_sent",
      resource: "message",
      resourceId: message._id,
      metadata: { receiverId: data.receiverId },
    });

    return message;
  }

  async getConversation(
    user1Id: string,
    user2Id: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<any>> {
    const result = await Message.getConversation(user1Id, user2Id, page, limit);

    return {
      data: result.messages,
      pagination: result.pagination,
    };
  }

  async getUserConversations(userId: string): Promise<any[]> {
    return Message.getUserConversations(userId);
  }

  async markAsRead(senderId: string, receiverId: string): Promise<void> {
    await Message.markAsRead(senderId, receiverId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Message.getUnreadCount(userId);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await Message.findOne({
      _id: messageId,
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    if (!message) {
      throw new Error("Message not found");
    }

    await Message.findByIdAndDelete(messageId);

    // Log message deletion
    await AuditLog.logAction({
      userId,
      action: "message_deleted",
      resource: "message",
      resourceId: messageId,
    });
  }

  async getMessageById(messageId: string, userId: string): Promise<any> {
    const message = await Message.findOne({
      _id: messageId,
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "displayName photoURL")
      .populate("receiverId", "displayName photoURL");

    if (!message) {
      throw new Error("Message not found");
    }

    return message;
  }

  async searchMessages(
    userId: string,
    searchTerm: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<any>> {
    const query = {
      $or: [{ senderId: userId }, { receiverId: userId }],
      content: { $regex: searchTerm, $options: "i" },
    };

    const skip = (page - 1) * limit;

    const messages = await Message.find(query)
      .populate("senderId", "displayName photoURL")
      .populate("receiverId", "displayName photoURL")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments(query);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getMessageStats(userId: string): Promise<any> {
    const totalSent = await Message.countDocuments({ senderId: userId });
    const totalReceived = await Message.countDocuments({ receiverId: userId });
    const unread = await Message.getUnreadCount(userId);

    return {
      totalSent,
      totalReceived,
      unread,
      total: totalSent + totalReceived,
    };
  }
}
