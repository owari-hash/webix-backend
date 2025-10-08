import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface WebtoonEpisodeDocument extends Document {
  webtoonId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  episodeNumber: number;
  title: string;
  description?: string;
  content: string;
  images: string[];
  status: "draft" | "published" | "archived";
  publishedAt?: Date;
  viewCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebtoonEpisodeSchema = new Schema<WebtoonEpisodeDocument>(
  {
    webtoonId: {
      type: Schema.Types.ObjectId,
      ref: "webtoon",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    episodeNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique episode numbers per webtoon
WebtoonEpisodeSchema.index(
  { webtoonId: 1, episodeNumber: 1 },
  { unique: true }
);
WebtoonEpisodeSchema.index({ webtoonId: 1, status: 1 });
WebtoonEpisodeSchema.index({ publishedAt: -1 });
WebtoonEpisodeSchema.index({ createdAt: -1 });

// Pre-save middleware to set publishedAt
WebtoonEpisodeSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
  next();
});

export const WebtoonEpisode = mongoose.model<WebtoonEpisodeDocument>(
  "webtoonepisode",
  WebtoonEpisodeSchema
);
