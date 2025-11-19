const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comic",
      default: null,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      default: null,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    subdomain: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["like", "dislike"],
      default: "like",
    },
  },
  {
    timestamps: true,
  }
);

// Validation: Exactly one of comicId, chapterId, or commentId must be provided
likeSchema.pre("validate", function (next) {
  const targets = [this.comicId, this.chapterId, this.commentId].filter(
    (t) => t !== null
  );
  if (targets.length !== 1) {
    return next(
      new Error(
        "Exactly one of comicId, chapterId, or commentId must be provided"
      )
    );
  }
  next();
});

// Unique index to prevent duplicate likes/dislikes per user
likeSchema.index({ user: 1, comicId: 1, type: 1 }, { unique: true, sparse: true });
likeSchema.index({ user: 1, chapterId: 1, type: 1 }, { unique: true, sparse: true });
likeSchema.index({ user: 1, commentId: 1, type: 1 }, { unique: true, sparse: true });
likeSchema.index({ subdomain: 1 });

module.exports = mongoose.model("Like", likeSchema);
