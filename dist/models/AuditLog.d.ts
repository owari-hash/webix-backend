import mongoose, { Document } from "mongoose";
import { AuditLog as IAuditLog } from "../types";
export interface AuditLogDocument extends IAuditLog, Document {
}
export declare const AuditLog: mongoose.Model<AuditLogDocument, {}, {}, {}, mongoose.Document<unknown, {}, AuditLogDocument, {}, {}> & AuditLogDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AuditLog.d.ts.map