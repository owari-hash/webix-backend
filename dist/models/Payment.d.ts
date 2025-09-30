import mongoose, { Document } from "mongoose";
import { Payment as IPayment } from "../types";
export interface PaymentDocument extends IPayment, Document {
}
export declare const Payment: mongoose.Model<PaymentDocument, {}, {}, {}, mongoose.Document<unknown, {}, PaymentDocument, {}, {}> & PaymentDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Payment.d.ts.map