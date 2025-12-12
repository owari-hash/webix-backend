const mongoose = require("mongoose");

const userStatsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    totalChaptersRead: {
      type: Number,
      default: 0,
    },
    totalNovelChaptersRead: {
      type: Number,
      default: 0,
    },
    totalComments: {
      type: Number,
      default: 0,
    },
    totalLikesGiven: {
      type: Number,
      default: 0,
    },
    totalLikesReceived: {
      type: Number,
      default: 0,
    },
    achievements: [
      {
        achievement: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Achievement",
        },
        unlockedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    dailyStreak: {
      type: Number,
      default: 0,
    },
    lastLoginDate: {
      type: Date,
      default: null,
    },
    subdomain: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userStatsSchema.index({ user: 1, subdomain: 1 }, { unique: true });
userStatsSchema.index({ level: -1, xp: -1 });
userStatsSchema.index({ subdomain: 1 });

// Method to calculate level from XP
userStatsSchema.methods.calculateLevel = function () {
  // Level formula: level = floor(sqrt(xp / 100)) + 1
  // This means:
  // Level 1: 0-99 XP
  // Level 2: 100-399 XP
  // Level 3: 400-899 XP
  // Level 4: 900-1599 XP
  // etc.
  return Math.floor(Math.sqrt(this.xp / 100)) + 1;
};

// Method to get XP needed for next level
userStatsSchema.methods.getXPForNextLevel = function () {
  const currentLevel = this.level;
  const nextLevel = currentLevel + 1;
  // Reverse formula: xp = (level - 1)^2 * 100
  return Math.pow(nextLevel - 1, 2) * 100;
};

// Method to get XP progress for current level
userStatsSchema.methods.getXPProgress = function () {
  const currentLevelXP = Math.pow(this.level - 1, 2) * 100;
  const nextLevelXP = this.getXPForNextLevel();
  const currentProgress = this.xp - currentLevelXP;
  const totalNeeded = nextLevelXP - currentLevelXP;
  return {
    current: currentProgress,
    total: totalNeeded,
    percentage: totalNeeded > 0 ? (currentProgress / totalNeeded) * 100 : 100,
  };
};

// Method to get profile border color based on level
userStatsSchema.methods.getProfileBorder = function () {
  const level = this.level;
  if (level >= 50) return { color: "#FFD700", name: "Legendary", gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)" };
  if (level >= 40) return { color: "#C0C0C0", name: "Master", gradient: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)" };
  if (level >= 30) return { color: "#CD7F32", name: "Expert", gradient: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)" };
  if (level >= 20) return { color: "#9370DB", name: "Advanced", gradient: "linear-gradient(135deg, #9370DB 0%, #8A2BE2 100%)" };
  if (level >= 10) return { color: "#4169E1", name: "Intermediate", gradient: "linear-gradient(135deg, #4169E1 0%, #0000FF 100%)" };
  return { color: "#90EE90", name: "Beginner", gradient: "linear-gradient(135deg, #90EE90 0%, #32CD32 100%)" };
};

module.exports = mongoose.model("UserStats", userStatsSchema);
module.exports.schema = userStatsSchema;

