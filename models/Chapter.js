const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema(
  {
    comicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comic",
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
    images: {
      type: [String],
      required: [true, "At least one image is required"],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Chapter must have at least one image",
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

chapterSchema.index({ comicId: 1, chapterNumber: 1 }, { unique: true });
chapterSchema.index({ subdomain: 1 });

module.exports = mongoose.model("Chapter", chapterSchema);

