import mongoose, { Document } from "mongoose";
import { Notification as INotification } from "../types";
export interface NotificationDocument extends INotification, Document {
}
export declare const Notification: mongoose.Model<NotificationDocument, {}, {}, {}, mongoose.Document<unknown, {}, NotificationDocument, {}, {}> & NotificationDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Notification.d.ts.map