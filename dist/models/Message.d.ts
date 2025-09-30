import mongoose, { Document } from "mongoose";
import { Message as IMessage } from "../types";
export interface MessageDocument extends IMessage, Document {
}
export declare const Message: mongoose.Model<MessageDocument, {}, {}, {}, mongoose.Document<unknown, {}, MessageDocument, {}, {}> & MessageDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Message.d.ts.map