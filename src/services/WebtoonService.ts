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

    const auditLog = new AuditLog({
      userId,
      organizationId,
      action: "webtoon_created",
      resource: "webtoon",
      resourceId: webtoon._id,
    });
    await auditLog.save();

    return webtoon;
  }

  async getWebtoons(
    organizationId: string,
    page = 1,
    limit = 10,
    search?: string
  ): Promise<PaginatedResponse<any>> {
    const query: any = { organizationId };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const webtoons = await Webtoon.find(query)
      .populate("createdBy", "displayName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Webtoon.countDocuments(query);

    return {
      data: webtoons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getWebtoonById(webtoonId: string): Promise<any> {
    const webtoon = await Webtoon.findById(webtoonId).populate(
      "createdBy",
      "displayName email"
    );
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }
    return webtoon;
  }

  async viewWebtoon(webtoonId: string, userId?: string): Promise<any> {
    const webtoon = await this.getWebtoonById(webtoonId);

    // Track view analytics
    const analytics = new Analytics({
      organizationId: webtoon.organizationId,
      userId,
      resourceType: "webtoon",
      resourceId: webtoonId,
      metricType: "webtoon_views",
      metricValue: 1,
    });
    await analytics.save();

    return webtoon;
  }

  async updateWebtoon(
    webtoonId: string,
    updateData: any,
    userId: string
  ): Promise<any> {
    const webtoon = await Webtoon.findById(webtoonId);
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    Object.assign(webtoon, updateData);
    await webtoon.save();

    const auditLog = new AuditLog({
      userId,
      organizationId: webtoon.organizationId,
      action: "webtoon_updated",
      resource: "webtoon",
      resourceId: webtoonId,
    });
    await auditLog.save();

    return webtoon;
  }

  async deleteWebtoon(webtoonId: string, userId: string): Promise<void> {
    const webtoon = await Webtoon.findById(webtoonId);
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    // Delete all episodes
    await WebtoonEpisode.deleteMany({ webtoonId });

    // Delete webtoon
    await Webtoon.findByIdAndDelete(webtoonId);

    const auditLog = new AuditLog({
      userId,
      organizationId: webtoon.organizationId,
      action: "webtoon_deleted",
      resource: "webtoon",
      resourceId: webtoonId,
    });
    await auditLog.save();
  }

  async publishWebtoon(webtoonId: string, userId: string): Promise<any> {
    const webtoon = await Webtoon.findById(webtoonId);
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    webtoon.status = "published";
    webtoon.publishedAt = new Date();
    await webtoon.save();

    const auditLog = new AuditLog({
      userId,
      organizationId: webtoon.organizationId,
      action: "webtoon_published",
      resource: "webtoon",
      resourceId: webtoonId,
    });
    await auditLog.save();

    return webtoon;
  }

  async createEpisode(
    webtoonId: string,
    episodeData: any,
    userId: string
  ): Promise<any> {
    const webtoon = await Webtoon.findById(webtoonId);
    if (!webtoon) {
      throw new Error("Webtoon not found");
    }

    const episode = new WebtoonEpisode({
      ...episodeData,
      webtoonId,
      createdBy: userId,
    });
    await episode.save();

    const auditLog = new AuditLog({
      userId,
      organizationId: webtoon.organizationId,
      action: "episode_created",
      resource: "episode",
      resourceId: episode._id,
      metadata: { webtoonId, episodeNumber: episodeData.episodeNumber },
    });
    await auditLog.save();

    return episode;
  }

  async getEpisodes(
    webtoonId: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    const episodes = await WebtoonEpisode.find({ webtoonId })
      .populate("createdBy", "displayName email")
      .sort({ episodeNumber: 1 })
      .skip(skip)
      .limit(limit);

    const total = await WebtoonEpisode.countDocuments({ webtoonId });

    return {
      data: episodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getEpisodeById(episodeId: string): Promise<any> {
    const episode = await WebtoonEpisode.findById(episodeId).populate(
      "createdBy",
      "displayName email"
    );
    if (!episode) {
      throw new Error("Episode not found");
    }
    return episode;
  }

  async updateEpisode(
    episodeId: string,
    updateData: any,
    userId: string
  ): Promise<any> {
    const episode = await WebtoonEpisode.findById(episodeId);
    if (!episode) {
      throw new Error("Episode not found");
    }

    Object.assign(episode, updateData);
    await episode.save();

    // Get webtoon to get organizationId
    const webtoon = await Webtoon.findById(episode.webtoonId);
    const auditLog = new AuditLog({
      userId,
      organizationId: webtoon?.organizationId,
      action: "episode_updated",
      resource: "episode",
      resourceId: episodeId,
      metadata: { webtoonId: episode.webtoonId },
    });
    await auditLog.save();

    return episode;
  }

  async deleteEpisode(episodeId: string, userId: string): Promise<void> {
    const episode = await WebtoonEpisode.findById(episodeId);
    if (!episode) {
      throw new Error("Episode not found");
    }

    await WebtoonEpisode.findByIdAndDelete(episodeId);

    // Get webtoon to get organizationId
    const webtoon = await Webtoon.findById(episode.webtoonId);
    const auditLog = new AuditLog({
      userId,
      organizationId: webtoon?.organizationId,
      action: "episode_deleted",
      resource: "episode",
      resourceId: episodeId,
      metadata: { webtoonId: episode.webtoonId },
    });
    await auditLog.save();
  }

  async viewEpisode(episodeId: string, userId?: string): Promise<any> {
    const episode = await this.getEpisodeById(episodeId);

    // Track view analytics
    const analytics = new Analytics({
      organizationId: episode.organizationId,
      userId,
      resourceType: "episode",
      resourceId: episodeId,
      metricType: "episode_views",
      metricValue: 1,
    });
    await analytics.save();

    return episode;
  }
}
