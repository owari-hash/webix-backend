"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const Message_1 = require("../models/Message");
const AuditLog_1 = require("../models/AuditLog");
const index_1 = require("../index");
class MessageService {
    async sendMessage(data) {
        const message = await Message_1.Message.sendMessage(data);
        // Emit real-time message
        index_1.io.to(`user:${data.receiverId}`).emit("new-message", message);
        // Log message sending
        await AuditLog_1.AuditLog.logAction({
            userId: data.senderId,
            organizationId: data.organizationId,
            action: "message_sent",
            resource: "message",
            resourceId: message._id,
            metadata: { receiverId: data.receiverId },
        });
        return message;
    }
    async getConversation(user1Id, user2Id, page = 1, limit = 50) {
        const result = await Message_1.Message.getConversation(user1Id, user2Id, page, limit);
        return {
            data: result.messages,
            pagination: result.pagination,
        };
    }
    async getUserConversations(userId) {
        return Message_1.Message.getUserConversations(userId);
    }
    async markAsRead(senderId, receiverId) {
        await Message_1.Message.markAsRead(senderId, receiverId);
    }
    async getUnreadCount(userId) {
        return Message_1.Message.getUnreadCount(userId);
    }
    async deleteMessage(messageId, userId) {
        const message = await Message_1.Message.findOne({
            _id: messageId,
            $or: [{ senderId: userId }, { receiverId: userId }],
        });
        if (!message) {
            throw new Error("Message not found");
        }
        await Message_1.Message.findByIdAndDelete(messageId);
        // Log message deletion
        await AuditLog_1.AuditLog.logAction({
            userId,
            action: "message_deleted",
            resource: "message",
            resourceId: messageId,
        });
    }
    async getMessageById(messageId, userId) {
        const message = await Message_1.Message.findOne({
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
    async searchMessages(userId, searchTerm, page = 1, limit = 20) {
        const query = {
            $or: [{ senderId: userId }, { receiverId: userId }],
            content: { $regex: searchTerm, $options: "i" },
        };
        const skip = (page - 1) * limit;
        const messages = await Message_1.Message.find(query)
            .populate("senderId", "displayName photoURL")
            .populate("receiverId", "displayName photoURL")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await Message_1.Message.countDocuments(query);
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
    async getMessageStats(userId) {
        const totalSent = await Message_1.Message.countDocuments({ senderId: userId });
        const totalReceived = await Message_1.Message.countDocuments({ receiverId: userId });
        const unread = await Message_1.Message.getUnreadCount(userId);
        return {
            totalSent,
            totalReceived,
            unread,
            total: totalSent + totalReceived,
        };
    }
}
exports.MessageService = MessageService;
