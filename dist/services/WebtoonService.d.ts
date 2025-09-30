import { PaginatedResponse } from "../types";
export declare class WebtoonService {
    createWebtoon(webtoonData: any, organizationId: string, userId: string): Promise<any>;
    getWebtoons(organizationId: string, page?: number, limit?: number, status?: string, search?: string): Promise<PaginatedResponse<any>>;
    getWebtoonById(webtoonId: string, organizationId: string): Promise<any>;
    updateWebtoon(webtoonId: string, updateData: any, organizationId: string, userId: string): Promise<any>;
    deleteWebtoon(webtoonId: string, organizationId: string, userId: string): Promise<void>;
    createEpisode(episodeData: any, webtoonId: string, organizationId: string, userId: string): Promise<any>;
    getEpisodes(webtoonId: string, organizationId: string, page?: number, limit?: number, status?: string): Promise<PaginatedResponse<any>>;
    getEpisodeById(episodeId: string, webtoonId: string, organizationId: string): Promise<any>;
    updateEpisode(episodeId: string, updateData: any, webtoonId: string, organizationId: string, userId: string): Promise<any>;
    deleteEpisode(episodeId: string, webtoonId: string, organizationId: string, userId: string): Promise<void>;
    publishWebtoon(webtoonId: string, organizationId: string, userId: string): Promise<any>;
    publishEpisode(episodeId: string, webtoonId: string, organizationId: string, userId: string): Promise<any>;
    viewWebtoon(webtoonId: string, organizationId: string, userId?: string): Promise<void>;
}
//# sourceMappingURL=WebtoonService.d.ts.map