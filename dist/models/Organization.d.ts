import mongoose, { Document } from "mongoose";
import { Organization as IOrganization } from "../types";
export interface OrganizationDocument extends IOrganization, Document {
}
export declare const Organization: mongoose.Model<OrganizationDocument, {}, {}, {}, mongoose.Document<unknown, {}, OrganizationDocument, {}, {}> & OrganizationDocument & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Organization.d.ts.map