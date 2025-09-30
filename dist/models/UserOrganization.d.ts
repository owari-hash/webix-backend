import mongoose, { Document } from "mongoose";
import { UserOrganization as IUserOrganization } from "../types";
export interface UserOrganizationDocument extends IUserOrganization, Document {
}
export declare const UserOrganization: mongoose.Model<UserOrganizationDocument, {}, {}, {}, mongoose.Document<unknown, {}, UserOrganizationDocument, {}, {}> & UserOrganizationDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=UserOrganization.d.ts.map