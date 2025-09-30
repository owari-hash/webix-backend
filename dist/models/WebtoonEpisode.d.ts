import mongoose, { Document } from "mongoose";
import { WebtoonEpisode as IWebtoonEpisode } from "../types";
export interface WebtoonEpisodeDocument extends IWebtoonEpisode, Document {
}
export declare const WebtoonEpisode: mongoose.Model<WebtoonEpisodeDocument, {}, {}, {}, mongoose.Document<unknown, {}, WebtoonEpisodeDocument, {}, {}> & WebtoonEpisodeDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=WebtoonEpisode.d.ts.map