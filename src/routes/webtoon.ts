import express from "express";
import { WebtoonService } from "../services/WebtoonService";
import {
  authMiddleware,
  organizationAccessMiddleware,
  validateRequest,
  permissionMiddleware,
} from "../middleware";
import {
  createWebtoonSchema,
  createEpisodeSchema,
} from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const webtoonService = new WebtoonService();

// Create webtoon
router.post(
  "/:organizationId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:write"]),
  validateRequest(createWebtoonSchema),
  asyncHandler(async (req, res) => {
    const webtoon = await webtoonService.createWebtoon(
      req.body,
      req.params.organizationId,
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      message: "Webtoon created successfully",
      data: webtoon,
    });
  })
);

// Get webtoons
router.get(
  "/:organizationId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:read"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;

    const result = await webtoonService.getWebtoons(
      req.params.organizationId,
      Number(page),
      Number(limit),
      search as string
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get webtoon by ID
router.get(
  "/:organizationId/:webtoonId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:read"]),
  asyncHandler(async (req, res) => {
    const webtoon = await webtoonService.getWebtoonById(
      req.params.webtoonId
    );

    // Track view
    await webtoonService.viewWebtoon(
      req.params.webtoonId,
      req.user!.userId
    );

    res.json({
      success: true,
      data: webtoon,
    });
  })
);

// Update webtoon
router.put(
  "/:organizationId/:webtoonId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:write"]),
  validateRequest(createWebtoonSchema),
  asyncHandler(async (req, res) => {
    const webtoon = await webtoonService.updateWebtoon(
      req.params.webtoonId,
      req.body,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Webtoon updated successfully",
      data: webtoon,
    });
  })
);

// Delete webtoon
router.delete(
  "/:organizationId/:webtoonId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:delete"]),
  asyncHandler(async (req, res) => {
    await webtoonService.deleteWebtoon(
      req.params.webtoonId,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Webtoon deleted successfully",
    });
  })
);

// Publish webtoon
router.post(
  "/:organizationId/:webtoonId/publish",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:write"]),
  asyncHandler(async (req, res) => {
    const webtoon = await webtoonService.publishWebtoon(
      req.params.webtoonId,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Webtoon published successfully",
      data: webtoon,
    });
  })
);

// Create episode
router.post(
  "/:organizationId/:webtoonId/episodes",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:write"]),
  validateRequest(createEpisodeSchema),
  asyncHandler(async (req, res) => {
    const episode = await webtoonService.createEpisode(
      req.params.webtoonId,
      req.body,
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      message: "Episode created successfully",
      data: episode,
    });
  })
);

// Get episodes
router.get(
  "/:organizationId/:webtoonId/episodes",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:read"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const result = await webtoonService.getEpisodes(
      req.params.webtoonId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get episode by ID
router.get(
  "/:organizationId/:webtoonId/episodes/:episodeId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:read"]),
  asyncHandler(async (req, res) => {
    const episode = await webtoonService.getEpisodeById(
      req.params.episodeId
    );

    res.json({
      success: true,
      data: episode,
    });
  })
);

// Update episode
router.put(
  "/:organizationId/:webtoonId/episodes/:episodeId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:write"]),
  validateRequest(createEpisodeSchema),
  asyncHandler(async (req, res) => {
    const episode = await webtoonService.updateEpisode(
      req.params.episodeId,
      req.body,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Episode updated successfully",
      data: episode,
    });
  })
);

// Delete episode
router.delete(
  "/:organizationId/:webtoonId/episodes/:episodeId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:delete"]),
  asyncHandler(async (req, res) => {
    await webtoonService.deleteEpisode(
      req.params.episodeId,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Episode deleted successfully",
    });
  })
);

// Publish episode
router.post(
  "/:organizationId/:webtoonId/episodes/:episodeId/publish",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["content:write"]),
  asyncHandler(async (req, res) => {
    // Episode publishing not implemented yet
    // const episode = await webtoonService.publishEpisode(
    //   req.params.episodeId,
    //   req.user!.userId
    // );

    res.json({
      success: true,
      message: "Episode published successfully",
      data: null,
    });
  })
);

export default router;
