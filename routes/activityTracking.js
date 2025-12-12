const express = require("express");
const { authenticate } = require("../middleware/auth");
const { trackChapterRead } = require("../utils/achievementService");

const router = express.Router();

/**
 * POST /api2/achievements/track-read
 * Track chapter read for achievements
 */
router.post("/track-read", authenticate, async (req, res) => {
  try {
    const { chapterId, isNovel = false } = req.body;
    
    if (!chapterId) {
      return res.status(400).json({
        success: false,
        message: "Chapter ID is required",
      });
    }
    
    const result = await trackChapterRead(
      req.db,
      req.user.userId,
      req.subdomain,
      chapterId,
      isNovel
    );
    
    res.json({
      success: true,
      data: {
        leveledUp: result.leveledUp,
        newLevel: result.newLevel,
        oldLevel: result.oldLevel,
        xp: result.userStats.xp,
      },
    });
  } catch (error) {
    console.error("Error tracking chapter read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track chapter read",
      error: error.message,
    });
  }
});

module.exports = router;

