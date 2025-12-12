const mongoose = require("mongoose");

const novelChapterSchema = new mongoose.Schema(
  {
    novelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Novel",
      required: true,
    },
    chapterNumber: {
      type: Number,
      required: [true, "Chapter number is required"],
    },
    title: {
      type: String,
      required: [true, "Chapter title is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Chapter content is required"],
      validate: {
        validator: function (v) {
          return v && v.trim().length > 0;
        },
        message: "Chapter must have content",
      },
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
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

novelChapterSchema.index({ novelId: 1, chapterNumber: 1 }, { unique: true });
novelChapterSchema.index({ subdomain: 1 });

module.exports = mongoose.model("NovelChapter", novelChapterSchema);

