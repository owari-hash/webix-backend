const express = require("express");
const { authenticate } = require("../middleware/auth");
const {
  getUserStats,
  trackDailyLogin,
  initializeDefaultAchievements,
} = require("../utils/achievementService");

const router = express.Router();

/**
 * GET /api2/achievements/stats
 * Get current user's stats and achievements
 */
router.get("/stats", authenticate, async (req, res) => {
  try {
    const UserStatsSchema = require("../models/UserStats").schema;
    const UserStats = req.db.models.UserStats || req.db.model("UserStats", UserStatsSchema);
    const userStats = await UserStats.findOne({ user: req.user.userId, subdomain: req.subdomain });
    
    if (!userStats) {
      // Create default stats
      const newStats = new UserStats({
        user: req.user.userId,
        subdomain: req.subdomain,
        xp: 0,
        level: 1,
      });
      await newStats.save();
      
      const xpProgress = newStats.getXPProgress();
      const profileBorder = newStats.getProfileBorder();
      
      return res.json({
        success: true,
        data: {
          xp: 0,
          level: 1,
          xpProgress,
          profileBorder,
          totalChaptersRead: 0,
          totalNovelChaptersRead: 0,
          totalComments: 0,
          totalLikesGiven: 0,
          totalLikesReceived: 0,
          achievements: [],
          dailyStreak: 0,
          lastActivity: new Date(),
        },
      });
    }
    
    // Populate achievements
    const Achievement = req.db.model("Achievement", require("../models/Achievement").schema);
    await userStats.populate({
      path: "achievements.achievement",
      select: "name description icon badgeColor type requirement",
    });
    
    const xpProgress = userStats.getXPProgress();
    const profileBorder = userStats.getProfileBorder();
    
    res.json({
      success: true,
      data: {
        xp: userStats.xp,
        level: userStats.level,
        xpProgress,
        profileBorder,
        totalChaptersRead: userStats.totalChaptersRead,
        totalNovelChaptersRead: userStats.totalNovelChaptersRead,
        totalComments: userStats.totalComments,
        totalLikesGiven: userStats.totalLikesGiven,
        totalLikesReceived: userStats.totalLikesReceived,
        achievements: userStats.achievements,
        dailyStreak: userStats.dailyStreak,
        lastActivity: userStats.lastActivity,
      },
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user stats",
      error: error.message,
    });
  }
});

/**
 * GET /api2/achievements/stats/:userId
 * Get another user's stats (public)
 */
router.get("/stats/:userId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const userId = req.params.userId;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }
    
    const UserStatsSchema = require("../models/UserStats").schema;
    const UserStats = req.db.models.UserStats || req.db.model("UserStats", UserStatsSchema);
    const userStats = await UserStats.findOne({
      user: userId,
      subdomain: req.subdomain,
    });
    
    if (!userStats) {
      return res.json({
        success: true,
        data: {
          xp: 0,
          level: 1,
          xpProgress: { current: 0, total: 100, percentage: 0 },
          profileBorder: { color: "#90EE90", name: "Beginner", gradient: "linear-gradient(135deg, #90EE90 0%, #32CD32 100%)" },
          totalChaptersRead: 0,
          totalNovelChaptersRead: 0,
          totalComments: 0,
          totalLikesGiven: 0,
          totalLikesReceived: 0,
          achievements: [],
          dailyStreak: 0,
        },
      });
    }
    
    // Populate achievements
    const Achievement = req.db.model("Achievement", require("../models/Achievement").schema);
    await userStats.populate({
      path: "achievements.achievement",
      select: "name description icon badgeColor type requirement",
    });
    
    const xpProgress = userStats.getXPProgress();
    const profileBorder = userStats.getProfileBorder();
    
    res.json({
      success: true,
      data: {
        xp: userStats.xp,
        level: userStats.level,
        xpProgress,
        profileBorder,
        totalChaptersRead: userStats.totalChaptersRead,
        totalNovelChaptersRead: userStats.totalNovelChaptersRead,
        totalComments: userStats.totalComments,
        totalLikesGiven: userStats.totalLikesGiven,
        totalLikesReceived: userStats.totalLikesReceived,
        achievements: userStats.achievements,
        dailyStreak: userStats.dailyStreak,
      },
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user stats",
      error: error.message,
    });
  }
});

/**
 * GET /api2/achievements/list
 * Get all available achievements
 */
router.get("/list", async (req, res) => {
  try {
    const AchievementSchema = require("../models/Achievement").schema;
    const Achievement = req.db.models.Achievement || req.db.model("Achievement", AchievementSchema);
    const achievements = await Achievement.find({
      subdomain: req.subdomain,
      isActive: true,
    }).sort({ requirement: 1 });
    
    res.json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    console.error("Error getting achievements:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get achievements",
      error: error.message,
    });
  }
});

/**
 * POST /api2/achievements/track-login
 * Track daily login (call this on user login)
 */
router.post("/track-login", authenticate, async (req, res) => {
  try {
    const result = await trackDailyLogin(req.db, req.user.userId, req.subdomain);
    
    res.json({
      success: true,
      data: {
        leveledUp: result.leveledUp,
        newLevel: result.newLevel,
        dailyStreak: result.userStats.dailyStreak,
        xpGained: result.userStats.xp,
      },
    });
  } catch (error) {
    console.error("Error tracking login:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track login",
      error: error.message,
    });
  }
});

/**
 * POST /api2/achievements/initialize
 * Initialize default achievements for subdomain (admin only)
 */
router.post("/initialize", authenticate, async (req, res) => {
  try {
    // Check if user is admin
    const UserSchema = require("../models/User").schema;
    const User = req.db.models.User || req.db.model("User", UserSchema);
    const user = await User.findById(req.user.userId);
    
    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }
    
    await initializeDefaultAchievements(req.db, req.subdomain);
    
    res.json({
      success: true,
      message: "Default achievements initialized",
    });
  } catch (error) {
    console.error("Error initializing achievements:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initialize achievements",
      error: error.message,
    });
  }
});

module.exports = router;

