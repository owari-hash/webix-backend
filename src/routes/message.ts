import express from "express";
import { MessageService } from "../services/MessageService";
import {
  authMiddleware,
  organizationAccessMiddleware,
  validateRequest,
  permissionMiddleware,
} from "../middleware";
import { sendMessageSchema } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const messageService = new MessageService();

// Send message
router.post(
  "/",
  authMiddleware,
  validateRequest(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const message = await messageService.sendMessage({
      senderId: req.user!.userId,
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  })
);

// Get conversation
router.get(
  "/conversation/:userId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;

    const result = await messageService.getConversation(
      req.user!.userId,
      req.params.userId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get user conversations
router.get(
  "/conversations",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const conversations = await messageService.getUserConversations(
      req.user!.userId
    );

    res.json({
      success: true,
      data: conversations,
    });
  })
);

// Mark messages as read
router.put(
  "/mark-read/:senderId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await messageService.markAsRead(req.params.senderId, req.user!.userId);

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  })
);

// Get unread count
router.get(
  "/unread-count",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const count = await messageService.getUnreadCount(req.user!.userId);

    res.json({
      success: true,
      data: { count },
    });
  })
);

// Get message by ID
router.get(
  "/:messageId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const message = await messageService.getMessageById(
      req.params.messageId,
      req.user!.userId
    );

    res.json({
      success: true,
      data: message,
    });
  })
);

// Delete message
router.delete(
  "/:messageId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await messageService.deleteMessage(req.params.messageId, req.user!.userId);

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  })
);

// Search messages
router.get(
  "/search/:searchTerm",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const result = await messageService.searchMessages(
      req.user!.userId,
      req.params.searchTerm,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get message statistics
router.get(
  "/stats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const stats = await messageService.getMessageStats(req.user!.userId);

    res.json({
      success: true,
      data: stats,
    });
  })
);

export default router;
