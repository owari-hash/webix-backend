const mongoose = require("mongoose");

const readingHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    comicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comic",
      default: null,
    },
    novelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Novel",
      default: null,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      default: null,
    },
    novelChapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NovelChapter",
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
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

// Validation: Exactly one of comicId or novelId must be provided
readingHistorySchema.pre("validate", function (next) {
  const targets = [this.comicId, this.novelId].filter((t) => t !== null);
  if (targets.length !== 1) {
    return next(
      new Error("Exactly one of comicId or novelId must be provided")
    );
  }
  next();
});

// Indexes for better query performance
readingHistorySchema.index({ user: 1, subdomain: 1, lastReadAt: -1 });
readingHistorySchema.index({ user: 1, comicId: 1 });
readingHistorySchema.index({ user: 1, novelId: 1 });
readingHistorySchema.index({ comicId: 1, subdomain: 1 });
readingHistorySchema.index({ novelId: 1, subdomain: 1 });

module.exports = mongoose.model("ReadingHistory", readingHistorySchema);


