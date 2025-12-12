// XP rewards for different activities
const XP_REWARDS = {
  READ_CHAPTER: 10,
  READ_NOVEL_CHAPTER: 15,
  COMMENT: 5,
  COMMENT_LIKE: 2,
  RECEIVE_COMMENT_LIKE: 3,
  DAILY_LOGIN: 5,
};

/**
 * Get or create user stats
 * @param {Object} db - Mongoose connection for the subdomain
 * @param {String} userId - User ID
 * @param {String} subdomain - Subdomain
 */
async function getUserStats(db, userId, subdomain) {
  // Get schema from model file
  const UserStatsSchema = require("../models/UserStats").schema;
  const UserStats = db.models.UserStats || db.model("UserStats", UserStatsSchema);
  
  let userStats = await UserStats.findOne({ user: userId, subdomain });
  
  if (!userStats) {
    userStats = new UserStats({
      user: userId,
      subdomain,
      xp: 0,
      level: 1,
    });
    await userStats.save();
  }
  
  return userStats;
}

/**
 * Add XP to user and check for level up
 */
async function addXP(db, userId, subdomain, amount, activityType = null) {
  const userStats = await getUserStats(db, userId, subdomain);
  
  const oldLevel = userStats.level;
  userStats.xp += amount;
  userStats.level = userStats.calculateLevel();
  userStats.lastActivity = new Date();
  
  await userStats.save();
  
  const leveledUp = userStats.level > oldLevel;
  
  return {
    userStats,
    leveledUp,
    newLevel: userStats.level,
    oldLevel,
  };
}

/**
 * Track chapter read
 */
async function trackChapterRead(db, userId, subdomain, chapterId, isNovel = false) {
  const userStats = await getUserStats(db, userId, subdomain);
  
  // Check if already read (prevent duplicate XP)
  // In a real implementation, you'd track this in a separate collection
  // For now, we'll just add XP
  
  const xpAmount = isNovel ? XP_REWARDS.READ_NOVEL_CHAPTER : XP_REWARDS.READ_CHAPTER;
  const result = await addXP(db, userId, subdomain, xpAmount, isNovel ? "read_novel_chapter" : "read_chapter");
  
  // Update read counts
  if (isNovel) {
    userStats.totalNovelChaptersRead += 1;
  } else {
    userStats.totalChaptersRead += 1;
  }
  await userStats.save();
  
  // Check achievements
  await checkAchievements(db, userId, subdomain, userStats);
  
  return result;
}

/**
 * Track comment
 */
async function trackComment(db, userId, subdomain) {
  const userStats = await getUserStats(db, userId, subdomain);
  
  const result = await addXP(db, userId, subdomain, XP_REWARDS.COMMENT, "comment");
  
  userStats.totalComments += 1;
  await userStats.save();
  
  // Check achievements
  await checkAchievements(db, userId, subdomain, userStats);
  
  return result;
}

/**
 * Track like given
 */
async function trackLikeGiven(db, userId, subdomain, isCommentLike = false) {
  const userStats = await getUserStats(db, userId, subdomain);
  
  const xpAmount = isCommentLike ? XP_REWARDS.COMMENT_LIKE : XP_REWARDS.COMMENT_LIKE;
  const result = await addXP(db, userId, subdomain, xpAmount, "comment_like");
  
  userStats.totalLikesGiven += 1;
  await userStats.save();
  
  return result;
}

/**
 * Track like received (for comment author)
 */
async function trackLikeReceived(db, userId, subdomain) {
  const userStats = await getUserStats(db, userId, subdomain);
  
  const result = await addXP(db, userId, subdomain, XP_REWARDS.RECEIVE_COMMENT_LIKE, "receive_like");
  
  userStats.totalLikesReceived += 1;
  await userStats.save();
  
  return result;
}

/**
 * Track daily login
 */
async function trackDailyLogin(db, userId, subdomain) {
  const userStats = await getUserStats(db, userId, subdomain);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastLogin = userStats.lastLoginDate ? new Date(userStats.lastLoginDate) : null;
  if (lastLogin) {
    lastLogin.setHours(0, 0, 0, 0);
  }
  
  // Check if already logged in today
  if (lastLogin && lastLogin.getTime() === today.getTime()) {
    return { userStats, alreadyLoggedIn: true };
  }
  
  // Check streak
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (lastLogin && lastLogin.getTime() === yesterday.getTime()) {
    userStats.dailyStreak += 1;
  } else if (!lastLogin || lastLogin.getTime() < yesterday.getTime()) {
    userStats.dailyStreak = 1;
  }
  
  userStats.lastLoginDate = new Date();
  const result = await addXP(db, userId, subdomain, XP_REWARDS.DAILY_LOGIN, "daily_login");
  
  await userStats.save();
  
  // Check achievements
  await checkAchievements(db, userId, subdomain, userStats);
  
  return result;
}

/**
 * Check and unlock achievements
 */
async function checkAchievements(db, userId, subdomain, userStats) {
  const AchievementSchema = require("../models/Achievement").schema;
  const Achievement = db.models.Achievement || db.model("Achievement", AchievementSchema);
  
  const achievements = await Achievement.find({
    subdomain,
    isActive: true,
  });
  
  const unlockedAchievements = [];
  
  for (const achievement of achievements) {
    // Check if user already has this achievement
    const hasAchievement = userStats.achievements.some(
      (a) => a.achievement.toString() === achievement._id.toString()
    );
    
    if (hasAchievement) continue;
    
    // Check if requirement is met
    let requirementMet = false;
    
    switch (achievement.type) {
      case "read_chapter":
        requirementMet = userStats.totalChaptersRead >= achievement.requirement;
        break;
      case "read_novel_chapter":
        requirementMet = userStats.totalNovelChaptersRead >= achievement.requirement;
        break;
      case "comment":
      case "comment_milestone":
        requirementMet = userStats.totalComments >= achievement.requirement;
        break;
      case "read_milestone":
        requirementMet = (userStats.totalChaptersRead + userStats.totalNovelChaptersRead) >= achievement.requirement;
        break;
      case "daily_login":
        requirementMet = userStats.dailyStreak >= achievement.requirement;
        break;
      default:
        requirementMet = false;
    }
    
    if (requirementMet) {
      // Unlock achievement
      userStats.achievements.push({
        achievement: achievement._id,
        unlockedAt: new Date(),
      });
      
      // Award XP from achievement
      if (achievement.xpReward > 0) {
        await addXP(db, userId, subdomain, achievement.xpReward, `achievement_${achievement.type}`);
      }
      
      unlockedAchievements.push(achievement);
    }
  }
  
  if (unlockedAchievements.length > 0) {
    await userStats.save();
  }
  
  return unlockedAchievements;
}

/**
 * Initialize default achievements for a subdomain
 */
async function initializeDefaultAchievements(db, subdomain) {
  const AchievementSchema = require("../models/Achievement").schema;
  const Achievement = db.models.Achievement || db.model("Achievement", AchievementSchema);
  
  const defaultAchievements = [
    {
      name: "First Steps",
      description: "Read your first chapter",
      type: "read_chapter",
      requirement: 1,
      xpReward: 50,
      icon: "📖",
      badgeColor: "#90EE90",
    },
    {
      name: "Novel Enthusiast",
      description: "Read your first novel chapter",
      type: "read_novel_chapter",
      requirement: 1,
      xpReward: 50,
      icon: "📚",
      badgeColor: "#4169E1",
    },
    {
      name: "Voice Heard",
      description: "Post your first comment",
      type: "comment",
      requirement: 1,
      xpReward: 25,
      icon: "💬",
      badgeColor: "#9370DB",
    },
    {
      name: "Chapter Master",
      description: "Read 10 chapters",
      type: "read_milestone",
      requirement: 10,
      xpReward: 100,
      icon: "⭐",
      badgeColor: "#CD7F32",
    },
    {
      name: "Bookworm",
      description: "Read 50 chapters",
      type: "read_milestone",
      requirement: 50,
      xpReward: 500,
      icon: "📖",
      badgeColor: "#C0C0C0",
    },
    {
      name: "Commentator",
      description: "Post 10 comments",
      type: "comment_milestone",
      requirement: 10,
      xpReward: 100,
      icon: "💭",
      badgeColor: "#9370DB",
    },
    {
      name: "Daily Reader",
      description: "Login 7 days in a row",
      type: "daily_login",
      requirement: 7,
      xpReward: 200,
      icon: "🔥",
      badgeColor: "#FF6347",
    },
  ];
  
  for (const achievementData of defaultAchievements) {
    const existing = await Achievement.findOne({
      subdomain,
      type: achievementData.type,
      requirement: achievementData.requirement,
    });
    
    if (!existing) {
      await Achievement.create({
        ...achievementData,
        subdomain,
      });
    }
  }
}

module.exports = {
  getUserStats,
  addXP,
  trackChapterRead,
  trackComment,
  trackLikeGiven,
  trackLikeReceived,
  trackDailyLogin,
  checkAchievements,
  initializeDefaultAchievements,
  XP_REWARDS,
};

