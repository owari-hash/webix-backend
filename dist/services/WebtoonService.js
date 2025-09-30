"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebtoonService = void 0;
const Webtoon_1 = require("../models/Webtoon");
const WebtoonEpisode_1 = require("../models/WebtoonEpisode");
const Analytics_1 = require("../models/Analytics");
const AuditLog_1 = require("../models/AuditLog");
class WebtoonService {
    async createWebtoon(webtoonData, organizationId, userId) {
        const webtoon = new Webtoon_1.Webtoon({
            ...webtoonData,
            organizationId,
            createdBy: userId,
        });
        await webtoon.save();
        // Log webtoon creation
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "webtoon_created",
            resource: "webtoon",
            resourceId: webtoon._id,
        });
        // Track analytics
        await Analytics_1.Analytics.trackMetric({
            organizationId,
            webtoonId: webtoon._id,
            metricType: "content_views",
            metricValue: 0,
        });
        return webtoon;
    }
    async getWebtoons(organizationId, page = 1, limit = 20, status, search) {
        const result = await Webtoon_1.Webtoon.getByOrganization(organizationId, status, page, limit);
        if (search) {
            const searchResult = await Webtoon_1.Webtoon.search(organizationId, search, page, limit);
            return searchResult;
        }
        return {
            data: result.webtoons,
            pagination: result.pagination,
        };
    }
    async getWebtoonById(webtoonId, organizationId) {
        const webtoon = await Webtoon_1.Webtoon.findOne({
            _id: webtoonId,
            organizationId,
        }).populate("createdBy", "displayName photoURL");
        if (!webtoon) {
            throw new Error("Webtoon not found");
        }
        return webtoon;
    }
    async updateWebtoon(webtoonId, updateData, organizationId, userId) {
        const webtoon = await Webtoon_1.Webtoon.findOne({ _id: webtoonId, organizationId });
        if (!webtoon) {
            throw new Error("Webtoon not found");
        }
        Object.assign(webtoon, updateData);
        await webtoon.save();
        // Log webtoon update
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "webtoon_updated",
            resource: "webtoon",
            resourceId: webtoonId,
        });
        return webtoon;
    }
    async deleteWebtoon(webtoonId, organizationId, userId) {
        const webtoon = await Webtoon_1.Webtoon.findOne({ _id: webtoonId, organizationId });
        if (!webtoon) {
            throw new Error("Webtoon not found");
        }
        // Delete all episodes first
        await WebtoonEpisode_1.WebtoonEpisode.deleteMany({ webtoonId });
        // Delete webtoon
        await Webtoon_1.Webtoon.findByIdAndDelete(webtoonId);
        // Log webtoon deletion
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "webtoon_deleted",
            resource: "webtoon",
            resourceId: webtoonId,
        });
    }
    async createEpisode(episodeData, webtoonId, organizationId, userId) {
        // Verify webtoon exists and user has access
        const webtoon = await this.getWebtoonById(webtoonId, organizationId);
        // Get next episode number
        const episodeNumber = await WebtoonEpisode_1.WebtoonEpisode.getNextEpisodeNumber(webtoonId);
        const episode = new WebtoonEpisode_1.WebtoonEpisode({
            ...episodeData,
            webtoonId,
            episodeNumber,
        });
        await episode.save();
        // Log episode creation
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "episode_created",
            resource: "webtoon_episode",
            resourceId: episode._id,
            metadata: { webtoonId, episodeNumber },
        });
        return episode;
    }
    async getEpisodes(webtoonId, organizationId, page = 1, limit = 20, status) {
        // Verify webtoon exists and user has access
        await this.getWebtoonById(webtoonId, organizationId);
        const result = await WebtoonEpisode_1.WebtoonEpisode.getByWebtoon(webtoonId, status, page, limit);
        return {
            data: result.episodes,
            pagination: result.pagination,
        };
    }
    async getEpisodeById(episodeId, webtoonId, organizationId) {
        // Verify webtoon exists and user has access
        await this.getWebtoonById(webtoonId, organizationId);
        const episode = await WebtoonEpisode_1.WebtoonEpisode.findOne({ _id: episodeId, webtoonId });
        if (!episode) {
            throw new Error("Episode not found");
        }
        return episode;
    }
    async updateEpisode(episodeId, updateData, webtoonId, organizationId, userId) {
        const episode = await this.getEpisodeById(episodeId, webtoonId, organizationId);
        Object.assign(episode, updateData);
        await episode.save();
        // Log episode update
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "episode_updated",
            resource: "webtoon_episode",
            resourceId: episodeId,
            metadata: { webtoonId },
        });
        return episode;
    }
    async deleteEpisode(episodeId, webtoonId, organizationId, userId) {
        const episode = await this.getEpisodeById(episodeId, webtoonId, organizationId);
        await WebtoonEpisode_1.WebtoonEpisode.findByIdAndDelete(episodeId);
        // Log episode deletion
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "episode_deleted",
            resource: "webtoon_episode",
            resourceId: episodeId,
            metadata: { webtoonId },
        });
    }
    async publishWebtoon(webtoonId, organizationId, userId) {
        const webtoon = await this.getWebtoonById(webtoonId, organizationId);
        webtoon.status = "published";
        webtoon.publishedAt = new Date();
        await webtoon.save();
        // Log webtoon publication
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "webtoon_published",
            resource: "webtoon",
            resourceId: webtoonId,
        });
        return webtoon;
    }
    async publishEpisode(episodeId, webtoonId, organizationId, userId) {
        const episode = await this.getEpisodeById(episodeId, webtoonId, organizationId);
        episode.status = "published";
        episode.publishedAt = new Date();
        await episode.save();
        // Log episode publication
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "episode_published",
            resource: "webtoon_episode",
            resourceId: episodeId,
            metadata: { webtoonId },
        });
        return episode;
    }
    async viewWebtoon(webtoonId, organizationId, userId) {
        // Track view analytics
        await Analytics_1.Analytics.trackMetric({
            organizationId,
            userId,
            webtoonId,
            metricType: "webtoon_views",
            metricValue: 1,
        });
    }
}
exports.WebtoonService = WebtoonService;
