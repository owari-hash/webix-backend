import { Message } from "../models/Message";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { PaginatedResponse } from "../types";
import mongoose from "mongoose";

export class MessageService {
  async sendMessage(data: {
    senderId: string;
    receiverId: string;
    organizationId?: string;
    content: string;
  }): Promise<any> {
    const message = new Message({
      senderId: new mongoose.Types.ObjectId(data.senderId),
      receiverId: new mongoose.Types.ObjectId(data.receiverId),
      organizationId: data.organizationId
        ? new mongoose.Types.ObjectId(data.organizationId)
        : undefined,
      content: data.content,
      isRead: false,
    });

    await message.save();

    // Emit real-time message

    // Log message sending
    const auditLog = new AuditLog({
      userId: new mongoose.Types.ObjectId(data.senderId),
      organizationId: data.organizationId
        ? new mongoose.Types.ObjectId(data.organizationId)
        : undefined,
      action: "message_sent",
      resource: "message",
      resourceId: message._id,
      metadata: { receiverId: data.receiverId },
    });
    await auditLog.save();

    return message;
  }

  async getConversation(
    user1Id: string,
    user2Id: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<any>> {
    const query = {
      $or: [
        {
          senderId: new mongoose.Types.ObjectId(user1Id),
          receiverId: new mongoose.Types.ObjectId(user2Id),
        },
        {
          senderId: new mongoose.Types.ObjectId(user2Id),
          receiverId: new mongoose.Types.ObjectId(user1Id),
        },
      ],
    };

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate("senderId", "displayName photoURL")
        .populate("receiverId", "displayName photoURL")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(query),
    ]);

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

  async getUserConversations(userId: string): Promise<any[]> {
    const pipeline: any[] = [
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { receiverId: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessage: { $last: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ["$receiverId", new mongoose.Types.ObjectId(userId)],
                    },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          userId: "$_id",
          user: {
            _id: "$user._id",
            displayName: "$user.displayName",
            photoURL: "$user.photoURL",
          },
          lastMessage: 1,
          unreadCount: 1,
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ];

    return Message.aggregate(pipeline);
  }

  async markAsRead(senderId: string, receiverId: string): Promise<void> {
    await Message.updateMany(
      {
        senderId: new mongoose.Types.ObjectId(senderId),
        receiverId: new mongoose.Types.ObjectId(receiverId),
        isRead: false,
      },
      { isRead: true }
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Message.countDocuments({
      receiverId: new mongoose.Types.ObjectId(userId),
      isRead: false,
    });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await Message.findOne({
      _id: new mongoose.Types.ObjectId(messageId),
      $or: [
        { senderId: new mongoose.Types.ObjectId(userId) },
        { receiverId: new mongoose.Types.ObjectId(userId) },
      ],
    });

    if (!message) {
      throw new Error("Message not found");
    }

    await Message.findByIdAndDelete(new mongoose.Types.ObjectId(messageId));

    // Log message deletion
    const auditLog = new AuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "message_deleted",
      resource: "message",
      resourceId: new mongoose.Types.ObjectId(messageId),
    });
    await auditLog.save();
  }

  async getMessageById(messageId: string, userId: string): Promise<any> {
    const message = await Message.findOne({
      _id: new mongoose.Types.ObjectId(messageId),
      $or: [
        { senderId: new mongoose.Types.ObjectId(userId) },
        { receiverId: new mongoose.Types.ObjectId(userId) },
      ],
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
      $or: [
        { senderId: new mongoose.Types.ObjectId(userId) },
        { receiverId: new mongoose.Types.ObjectId(userId) },
      ],
      content: { $regex: searchTerm, $options: "i" },
    };

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate("senderId", "displayName photoURL")
        .populate("receiverId", "displayName photoURL")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(query),
    ]);

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
    const [totalSent, totalReceived, unread] = await Promise.all([
      Message.countDocuments({ senderId: new mongoose.Types.ObjectId(userId) }),
      Message.countDocuments({
        receiverId: new mongoose.Types.ObjectId(userId),
      }),
      this.getUnreadCount(userId),
    ]);

    return {
      totalSent,
      totalReceived,
      unread,
      total: totalSent + totalReceived,
    };
  }
}
