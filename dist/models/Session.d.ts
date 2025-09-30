import mongoose, { Document } from "mongoose";
import { Session as ISession } from "../types";
export interface SessionDocument extends ISession, Document {
}
export declare const Session: mongoose.Model<SessionDocument, {}, {}, {}, mongoose.Document<unknown, {}, SessionDocument, {}, {}> & SessionDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Session.d.ts.map