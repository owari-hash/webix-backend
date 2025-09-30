"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MessageService_1 = require("../services/MessageService");
const middleware_1 = require("../middleware");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const messageService = new MessageService_1.MessageService();
// Send message
router.post("/", middleware_1.authMiddleware, (0, middleware_1.validateRequest)(validation_1.sendMessageSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const message = await messageService.sendMessage({
        senderId: req.user.userId,
        ...req.body,
    });
    res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: message,
    });
}));
// Get conversation
router.get("/conversation/:userId", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const result = await messageService.getConversation(req.user.userId, req.params.userId, Number(page), Number(limit));
    res.json({
        success: true,
        data: result,
    });
}));
// Get user conversations
router.get("/conversations", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const conversations = await messageService.getUserConversations(req.user.userId);
    res.json({
        success: true,
        data: conversations,
    });
}));
// Mark messages as read
router.put("/mark-read/:senderId", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await messageService.markAsRead(req.params.senderId, req.user.userId);
    res.json({
        success: true,
        message: "Messages marked as read",
    });
}));
// Get unread count
router.get("/unread-count", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const count = await messageService.getUnreadCount(req.user.userId);
    res.json({
        success: true,
        data: { count },
    });
}));
// Get message by ID
router.get("/:messageId", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const message = await messageService.getMessageById(req.params.messageId, req.user.userId);
    res.json({
        success: true,
        data: message,
    });
}));
// Delete message
router.delete("/:messageId", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await messageService.deleteMessage(req.params.messageId, req.user.userId);
    res.json({
        success: true,
        message: "Message deleted successfully",
    });
}));
// Search messages
router.get("/search/:searchTerm", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await messageService.searchMessages(req.user.userId, req.params.searchTerm, Number(page), Number(limit));
    res.json({
        success: true,
        data: result,
    });
}));
// Get message statistics
router.get("/stats", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const stats = await messageService.getMessageStats(req.user.userId);
    res.json({
        success: true,
        data: stats,
    });
}));
exports.default = router;
