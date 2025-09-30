import mongoose, { Document } from "mongoose";
import { Webtoon as IWebtoon } from "../types";
export interface WebtoonDocument extends IWebtoon, Document {
}
export declare const Webtoon: mongoose.Model<WebtoonDocument, {}, {}, {}, mongoose.Document<unknown, {}, WebtoonDocument, {}, {}> & WebtoonDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Webtoon.d.ts.map