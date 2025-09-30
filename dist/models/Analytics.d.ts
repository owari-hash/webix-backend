import mongoose, { Document } from "mongoose";
import { Analytics as IAnalytics } from "../types";
export interface AnalyticsDocument extends IAnalytics, Document {
}
export declare const Analytics: mongoose.Model<AnalyticsDocument, {}, {}, {}, mongoose.Document<unknown, {}, AnalyticsDocument, {}, {}> & AnalyticsDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Analytics.d.ts.map