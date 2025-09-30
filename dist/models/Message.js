"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const MessageSchema = new mongoose_1.Schema({
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    receiverId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "organization",
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
}, {
    timestamps: true,
});
// Compound indexes
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });
MessageSchema.index({ organizationId: 1, createdAt: -1 });
// Static method to send message
MessageSchema.statics.sendMessage = async function (data) {
    const message = new this(data);
    return message.save();
};
// Static method to get conversation
MessageSchema.statics.getConversation = async function (user1Id, user2Id, page = 1, limit = 50) {
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
MessageSchema.statics.getUserConversations = async function (userId) {
    const pipeline = [
        {
            $match: {
                $or: [
                    { senderId: new mongoose_1.default.Types.ObjectId(userId) },
                    { receiverId: new mongoose_1.default.Types.ObjectId(userId) },
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
                        { $eq: ["$senderId", new mongoose_1.default.Types.ObjectId(userId)] },
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
                                    { $eq: ["$receiverId", new mongoose_1.default.Types.ObjectId(userId)] },
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
    return this.aggregate(pipeline);
};
// Static method to mark messages as read
MessageSchema.statics.markAsRead = async function (senderId, receiverId) {
    return this.updateMany({ senderId, receiverId, isRead: false }, { isRead: true, readAt: new Date() });
};
// Static method to get unread count
MessageSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ receiverId: userId, isRead: false });
};
// Instance method to mark as read
MessageSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};
exports.Message = mongoose_1.default.model("message", MessageSchema);
