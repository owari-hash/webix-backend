"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Webtoon = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const WebtoonSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
    categories: [
        {
            type: String,
            trim: true,
        },
    ],
    tags: [
        {
            type: String,
            trim: true,
        },
    ],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    publishedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
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
    if (this.isModified("status") &&
        this.status === "published" &&
        !this.publishedAt) {
        this.publishedAt = new Date();
    }
    next();
});
// Static method to get webtoons by organization
WebtoonSchema.statics.getByOrganization = async function (organizationId, status, page = 1, limit = 20) {
    const query = { organizationId };
    if (status)
        query.status = status;
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
WebtoonSchema.statics.search = async function (organizationId, searchTerm, page = 1, limit = 20) {
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
exports.Webtoon = mongoose_1.default.model("webtoon", WebtoonSchema);
