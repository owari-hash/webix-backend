const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Achievement name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Achievement description is required"],
      trim: true,
    },
    icon: {
      type: String,
      default: null, // URL or emoji for achievement icon
    },
    type: {
      type: String,
      enum: [
        "read_chapter",
        "read_novel_chapter",
        "comment",
        "comment_like",
        "first_comment",
        "first_like",
        "read_milestone",
        "comment_milestone",
        "daily_login",
        "weekly_active",
      ],
      required: true,
    },
    requirement: {
      type: Number,
      required: true, // e.g., 10 chapters read, 5 comments, etc.
    },
    xpReward: {
      type: Number,
      default: 0, // XP awarded when achievement is unlocked
    },
    badgeColor: {
      type: String,
      default: "#FFD700", // Gold default
    },
    isActive: {
      type: Boolean,
      default: true,
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
achievementSchema.index({ type: 1, requirement: 1 });
achievementSchema.index({ subdomain: 1, isActive: 1 });

module.exports = mongoose.model("Achievement", achievementSchema);
module.exports.schema = achievementSchema;

