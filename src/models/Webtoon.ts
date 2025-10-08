import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface WebtoonDocument extends Document {
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  title: string;
  description: string;
  genre: string[];
  status: "draft" | "published" | "archived";
  coverImage?: string;
  tags: string[];
  publishedAt?: Date;
  viewCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebtoonSchema = new Schema<WebtoonDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: "text",
    },
    description: {
      type: String,
      trim: true,
    },
    coverImage: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
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

// Indexes
WebtoonSchema.index({ organizationId: 1, status: 1 });
WebtoonSchema.index({ createdBy: 1 });
WebtoonSchema.index({ publishedAt: -1 });
WebtoonSchema.index({ createdAt: -1 });
WebtoonSchema.index({ title: "text", description: "text" });
WebtoonSchema.index({ categories: 1 });
WebtoonSchema.index({ tags: 1 });

// Virtual for episode count
WebtoonSchema.virtual("episodeCount", {
  ref: "webtoonepisode",
  localField: "_id",
  foreignField: "webtoonId",
  count: true,
});

// Pre-save middleware to set publishedAt
WebtoonSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
  next();
});

// Static method to get webtoons by organization
WebtoonSchema.statics.getByOrganization = async function (
  organizationId: string,
  status?: string,
  page = 1,
  limit = 20
) {
  const query: any = { organizationId };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const webtoons = await this.find(query)
    .populate("createdBy", "displayName photoURL")
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    webtoons,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to search webtoons
WebtoonSchema.statics.search = async function (
  organizationId: string,
  searchTerm: string,
  page = 1,
  limit = 20
) {
  const query = {
    organizationId,
    $text: { $search: searchTerm },
  };

  const skip = (page - 1) * limit;

  const webtoons = await this.find(query, { score: { $meta: "textScore" } })
    .populate("createdBy", "displayName photoURL")
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    webtoons,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const Webtoon = mongoose.model<WebtoonDocument>(
  "webtoon",
  WebtoonSchema
);
