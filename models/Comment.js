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
    subdomain: {
      type: String,
      required: true,
      index: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Validation: Either comicId or chapterId must be provided
commentSchema.pre("validate", function (next) {
  if (!this.comicId && !this.chapterId) {
    return next(new Error("Either comicId or chapterId must be provided"));
  }
  if (this.comicId && this.chapterId) {
    return next(
      new Error("Comment cannot be associated with both comic and chapter")
    );
  }
  next();
});

// Indexes for faster queries
commentSchema.index({ comicId: 1, createdAt: -1 });
commentSchema.index({ chapterId: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ subdomain: 1 });

module.exports = mongoose.model("Comment", commentSchema);
