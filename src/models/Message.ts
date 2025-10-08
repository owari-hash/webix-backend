import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface MessageDocument extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  content: string;
  messageType: "text" | "image" | "file";
  attachments?: string[];
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<MessageDocument>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });
MessageSchema.index({ organizationId: 1, createdAt: -1 });

// Static method to send message
MessageSchema.statics.sendMessage = async function (data: {
  senderId: string;
  receiverId: string;
  organizationId?: string;
  content: string;
}) {
  const message = new this(data);
  return message.save();
};

// Static method to get conversation
MessageSchema.statics.getConversation = async function (
  user1Id: string,
  user2Id: string,
  page = 1,
  limit = 50
) {
  const skip = (page - 1) * limit;

  const messages = await this.find({
    $or: [
      { senderId: user1Id, receiverId: user2Id },
      { senderId: user2Id, receiverId: user1Id },
    ],
  })
    .populate("senderId", "displayName photoURL")
    .populate("receiverId", "displayName photoURL")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments({
    $or: [
      { senderId: user1Id, receiverId: user2Id },
      { senderId: user2Id, receiverId: user1Id },
    ],
  });

  return {
    messages: messages.reverse(), // Return in chronological order
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get user conversations
MessageSchema.statics.getUserConversations = async function (userId: string) {
  const pipeline = [
    {
      $match: {
        $or: [
          { senderId: new mongoose.Types.ObjectId(userId) },
          { receiverId: new mongoose.Types.ObjectId(userId) },
        ],
      },
    },
    {
      $sort: { createdAt: -1 },
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
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiverId", new mongoose.Types.ObjectId(userId)] },
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
        lastMessage: {
          _id: "$lastMessage._id",
          content: "$lastMessage.content",
          createdAt: "$lastMessage.createdAt",
          isRead: "$lastMessage.isRead",
        },
        unreadCount: 1,
      },
    },
    {
      $sort: { "lastMessage.createdAt": -1 },
    },
  ];
};

// Static method to mark messages as read
MessageSchema.statics.markAsRead = async function (
  senderId: string,
  receiverId: string
) {
  return this.updateMany(
    { senderId, receiverId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to get unread count
MessageSchema.statics.getUnreadCount = async function (userId: string) {
  return this.countDocuments({ receiverId: userId, isRead: false });
};

// Instance method to mark as read
MessageSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

export const Message = mongoose.model<MessageDocument>(
  "message",
  MessageSchema
);
