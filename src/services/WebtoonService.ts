import { Webtoon } from "../models/Webtoon";
import { WebtoonEpisode } from "../models/WebtoonEpisode";
import { Analytics } from "../models/Analytics";
import { AuditLog } from "../models/AuditLog";
import { PaginatedResponse } from "../types";

export class WebtoonService {
  async createWebtoon(
    webtoonData: any,
    organizationId: string,
    userId: string
  ): Promise<any> {
    const webtoon = new Webtoon({
      ...webtoonData,
      organizationId,
      createdBy: userId,
    });

    await webtoon.save();

    // Log webtoon creation
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "webtoon_created",
      resource: "webtoon",
      resourceId: webtoon._id,
    });

    // Track analytics
    await Analytics.trackMetric({
      organizationId,
      webtoonId: webtoon._id,
      metricType: "content_views",
      metricValue: 0,
    });

    return webtoon;
  }

  async getWebtoons(
    organizationId: string,
    page = 1,
    limit = 20,
    status?: string,
    search?: string
  ): Promise<PaginatedResponse<any>> {
    const result = await Webtoon.getByOrganization(
      organizationId,
      status,
      page,
      limit
    );

    if (search) {
      const searchResult = await Webtoon.search(
        organizationId,
        search,
        page,
        limit
      );
      return searchResult;
    }

    return {
      data: result.webtoons,
      pagination: result.pagination,
    };
  }

  async getWebtoonById(
    webtoonId: string,
    organizationId: string
  ): Promise<any> {
    const webtoon = await Webtoon.findOne({
      _id: webtoonId,
      organizationId,
    }).populate("createdBy", "displayName photoURL");

    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    return webtoon;
  }

  async updateWebtoon(
    webtoonId: string,
    updateData: any,
    organizationId: string,
    userId: string
  ): Promise<any> {
    const webtoon = await Webtoon.findOne({ _id: webtoonId, organizationId });
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    Object.assign(webtoon, updateData);
    await webtoon.save();

    // Log webtoon update
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "webtoon_updated",
      resource: "webtoon",
      resourceId: webtoonId,
    });

    return webtoon;
  }

  async deleteWebtoon(
    webtoonId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const webtoon = await Webtoon.findOne({ _id: webtoonId, organizationId });
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    // Delete all episodes first
    await WebtoonEpisode.deleteMany({ webtoonId });

    // Delete webtoon
    await Webtoon.findByIdAndDelete(webtoonId);

    // Log webtoon deletion
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "webtoon_deleted",
      resource: "webtoon",
      resourceId: webtoonId,
    });
  }

  async createEpisode(
    episodeData: any,
    webtoonId: string,
    organizationId: string,
    userId: string
  ): Promise<any> {
    // Verify webtoon exists and user has access
    const webtoon = await this.getWebtoonById(webtoonId, organizationId);

    // Get next episode number
    const episodeNumber = await WebtoonEpisode.getNextEpisodeNumber(webtoonId);

    const episode = new WebtoonEpisode({
      ...episodeData,
      webtoonId,
      episodeNumber,
    });

    await episode.save();

    // Log episode creation
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "episode_created",
      resource: "webtoon_episode",
      resourceId: episode._id,
      metadata: { webtoonId, episodeNumber },
    });

    return episode;
  }

  async getEpisodes(
    webtoonId: string,
    organizationId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResponse<any>> {
    // Verify webtoon exists and user has access
    await this.getWebtoonById(webtoonId, organizationId);

    const result = await WebtoonEpisode.getByWebtoon(
      webtoonId,
      status,
      page,
      limit
    );

    return {
      data: result.episodes,
      pagination: result.pagination,
    };
  }

  async getEpisodeById(
    episodeId: string,
    webtoonId: string,
    organizationId: string
  ): Promise<any> {
    // Verify webtoon exists and user has access
    await this.getWebtoonById(webtoonId, organizationId);

    const episode = await WebtoonEpisode.findOne({ _id: episodeId, webtoonId });
    if (!episode) {
      throw new Error("Episode not found");
    }

    return episode;
  }

  async updateEpisode(
    episodeId: string,
    updateData: any,
    webtoonId: string,
    organizationId: string,
    userId: string
  ): Promise<any> {
    const episode = await this.getEpisodeById(
      episodeId,
      webtoonId,
      organizationId
    );

    Object.assign(episode, updateData);
    await episode.save();

    // Log episode update
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "episode_updated",
      resource: "webtoon_episode",
      resourceId: episodeId,
      metadata: { webtoonId },
    });

    return episode;
  }

  async deleteEpisode(
    episodeId: string,
    webtoonId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const episode = await this.getEpisodeById(
      episodeId,
      webtoonId,
      organizationId
    );

    await WebtoonEpisode.findByIdAndDelete(episodeId);

    // Log episode deletion
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "episode_deleted",
      resource: "webtoon_episode",
      resourceId: episodeId,
      metadata: { webtoonId },
    });
  }

  async publishWebtoon(
    webtoonId: string,
    organizationId: string,
    userId: string
  ): Promise<any> {
    const webtoon = await this.getWebtoonById(webtoonId, organizationId);

    webtoon.status = "published";
    webtoon.publishedAt = new Date();
    await webtoon.save();

    // Log webtoon publication
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "webtoon_published",
      resource: "webtoon",
      resourceId: webtoonId,
    });

    return webtoon;
  }

  async publishEpisode(
    episodeId: string,
    webtoonId: string,
    organizationId: string,
    userId: string
  ): Promise<any> {
    const episode = await this.getEpisodeById(
      episodeId,
      webtoonId,
      organizationId
    );

    episode.status = "published";
    episode.publishedAt = new Date();
    await episode.save();

    // Log episode publication
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "episode_published",
      resource: "webtoon_episode",
      resourceId: episodeId,
      metadata: { webtoonId },
    });

    return episode;
  }

  async viewWebtoon(
    webtoonId: string,
    organizationId: string,
    userId?: string
  ): Promise<void> {
    // Track view analytics
    await Analytics.trackMetric({
      organizationId,
      userId,
      webtoonId,
      metricType: "webtoon_views",
      metricValue: 1,
    });
  }
}
