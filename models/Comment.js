const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [5000, "Comment cannot exceed 5000 characters"],
    },
    author: {
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
    novelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Novel",
      default: null,
    },
    novelChapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NovelChapter",
      default: null,
    },
    subdomain: {
      type: String,
      required: true,
      index: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    unLikes: {
      type: Number,
      default: 0,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Validation: Either comicId, chapterId, novelId, or novelChapterId must be provided (unless it's a reply)
commentSchema.pre("validate", function (next) {
  // If it's a reply (has parentId), it will inherit comicId/chapterId/novelId/novelChapterId from parent
  if (this.parentId) {
    return next();
  }

  // For top-level comments, at least one of comicId, chapterId, novelId, or novelChapterId must be provided
  const hasComic = !!this.comicId;
  const hasChapter = !!this.chapterId;
  const hasNovel = !!this.novelId;
  const hasNovelChapter = !!this.novelChapterId;

  if (!hasComic && !hasChapter && !hasNovel && !hasNovelChapter) {
    return next(
      new Error(
        "Either comicId, chapterId, novelId, or novelChapterId must be provided"
      )
    );
  }

  // Cannot have both comic and novel
  if ((hasComic || hasChapter) && (hasNovel || hasNovelChapter)) {
    return next(
      new Error("Comment cannot be associated with both comic and novel")
    );
  }

  // Cannot have both comicId and chapterId
  if (hasComic && hasChapter) {
    return next(
      new Error("Comment cannot be associated with both comic and chapter")
    );
  }

  // Cannot have both novelId and novelChapterId
  if (hasNovel && hasNovelChapter) {
    return next(
      new Error(
        "Comment cannot be associated with both novel and novel chapter"
      )
    );
  }

  next();
});

// Indexes for faster queries
commentSchema.index({ comicId: 1, createdAt: -1 });
commentSchema.index({ chapterId: 1, createdAt: -1 });
commentSchema.index({ novelId: 1, createdAt: -1 });
commentSchema.index({ novelChapterId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ subdomain: 1 });

module.exports = mongoose.model("Comment", commentSchema);
