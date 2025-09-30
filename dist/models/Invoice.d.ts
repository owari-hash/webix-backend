import mongoose, { Document } from "mongoose";
import { Invoice as IInvoice } from "../types";
export interface InvoiceDocument extends IInvoice, Document {
}
export declare const Invoice: mongoose.Model<InvoiceDocument, {}, {}, {}, mongoose.Document<unknown, {}, InvoiceDocument, {}, {}> & InvoiceDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Invoice.d.ts.map