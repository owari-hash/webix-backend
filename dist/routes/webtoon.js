"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const WebtoonService_1 = require("../services/WebtoonService");
const middleware_1 = require("../middleware");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const webtoonService = new WebtoonService_1.WebtoonService();
// Create webtoon
router.post("/:organizationId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:write"]), (0, middleware_1.validateRequest)(validation_1.createWebtoonSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const webtoon = await webtoonService.createWebtoon(req.body, req.params.organizationId, req.user.userId);
    res.status(201).json({
        success: true,
        message: "Webtoon created successfully",
        data: webtoon,
    });
}));
// Get webtoons
router.get("/:organizationId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;
    const result = await webtoonService.getWebtoons(req.params.organizationId, Number(page), Number(limit), status, search);
    res.json({
        success: true,
        data: result,
    });
}));
// Get webtoon by ID
router.get("/:organizationId/:webtoonId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const webtoon = await webtoonService.getWebtoonById(req.params.webtoonId, req.params.organizationId);
    // Track view
    await webtoonService.viewWebtoon(req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        data: webtoon,
    });
}));
// Update webtoon
router.put("/:organizationId/:webtoonId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:write"]), (0, middleware_1.validateRequest)(validation_1.createWebtoonSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const webtoon = await webtoonService.updateWebtoon(req.params.webtoonId, req.body, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Webtoon updated successfully",
        data: webtoon,
    });
}));
// Delete webtoon
router.delete("/:organizationId/:webtoonId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:delete"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await webtoonService.deleteWebtoon(req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Webtoon deleted successfully",
    });
}));
// Publish webtoon
router.post("/:organizationId/:webtoonId/publish", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const webtoon = await webtoonService.publishWebtoon(req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Webtoon published successfully",
        data: webtoon,
    });
}));
// Create episode
router.post("/:organizationId/:webtoonId/episodes", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:write"]), (0, middleware_1.validateRequest)(validation_1.createEpisodeSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const episode = await webtoonService.createEpisode(req.body, req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.status(201).json({
        success: true,
        message: "Episode created successfully",
        data: episode,
    });
}));
// Get episodes
router.get("/:organizationId/:webtoonId/episodes", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const result = await webtoonService.getEpisodes(req.params.webtoonId, req.params.organizationId, Number(page), Number(limit), status);
    res.json({
        success: true,
        data: result,
    });
}));
// Get episode by ID
router.get("/:organizationId/:webtoonId/episodes/:episodeId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const episode = await webtoonService.getEpisodeById(req.params.episodeId, req.params.webtoonId, req.params.organizationId);
    res.json({
        success: true,
        data: episode,
    });
}));
// Update episode
router.put("/:organizationId/:webtoonId/episodes/:episodeId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:write"]), (0, middleware_1.validateRequest)(validation_1.createEpisodeSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const episode = await webtoonService.updateEpisode(req.params.episodeId, req.body, req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Episode updated successfully",
        data: episode,
    });
}));
// Delete episode
router.delete("/:organizationId/:webtoonId/episodes/:episodeId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:delete"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await webtoonService.deleteEpisode(req.params.episodeId, req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Episode deleted successfully",
    });
}));
// Publish episode
router.post("/:organizationId/:webtoonId/episodes/:episodeId/publish", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["content:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const episode = await webtoonService.publishEpisode(req.params.episodeId, req.params.webtoonId, req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Episode published successfully",
        data: episode,
    });
}));
exports.default = router;
