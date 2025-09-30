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
exports.WebtoonEpisode = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const WebtoonEpisodeSchema = new mongoose_1.Schema({
    webtoonId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
// Compound index for unique episode numbers per webtoon
WebtoonEpisodeSchema.index({ webtoonId: 1, episodeNumber: 1 }, { unique: true });
WebtoonEpisodeSchema.index({ webtoonId: 1, status: 1 });
WebtoonEpisodeSchema.index({ publishedAt: -1 });
WebtoonEpisodeSchema.index({ createdAt: -1 });
// Pre-save middleware to set publishedAt
WebtoonEpisodeSchema.pre("save", function (next) {
    if (this.isModified("status") &&
        this.status === "published" &&
        !this.publishedAt) {
        this.publishedAt = new Date();
    }
    next();
});
// Static method to get episodes by webtoon
WebtoonEpisodeSchema.statics.getByWebtoon = async function (webtoonId, status, page = 1, limit = 20) {
    const query = { webtoonId };
    if (status)
        query.status = status;
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
WebtoonEpisodeSchema.statics.getNextEpisodeNumber = async function (webtoonId) {
    const lastEpisode = await this.findOne({ webtoonId })
        .sort({ episodeNumber: -1 })
        .select("episodeNumber");
    return lastEpisode ? lastEpisode.episodeNumber + 1 : 1;
};
exports.WebtoonEpisode = mongoose_1.default.model("webtoonepisode", WebtoonEpisodeSchema);
