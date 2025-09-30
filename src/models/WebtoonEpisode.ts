import mongoose, { Schema, Document } from "mongoose";
import { WebtoonEpisode as IWebtoonEpisode } from "../types";

mongoose.pluralize(null);

export interface WebtoonEpisodeDocument extends IWebtoonEpisode, Document {}

const WebtoonEpisodeSchema = new Schema<WebtoonEpisodeDocument>(
  {
    webtoonId: {
      type: Schema.Types.ObjectId,
      ref: "webtoon",
      required: true,
      index: true,
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

// Static method to get episodes by webtoon
WebtoonEpisodeSchema.statics.getByWebtoon = async function (
  webtoonId: string,
  status?: string,
  page = 1,
  limit = 20
) {
  const query: any = { webtoonId };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const episodes = await this.find(query)
    .sort({ episodeNumber: 1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    episodes,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get next episode number
WebtoonEpisodeSchema.statics.getNextEpisodeNumber = async function (
  webtoonId: string
) {
  const lastEpisode = await this.findOne({ webtoonId })
    .sort({ episodeNumber: -1 })
    .select("episodeNumber");

  return lastEpisode ? lastEpisode.episodeNumber + 1 : 1;
};

export const WebtoonEpisode = mongoose.model<WebtoonEpisodeDocument>(
  "webtoonepisode",
  WebtoonEpisodeSchema
);
