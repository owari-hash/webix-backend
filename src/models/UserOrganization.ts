import mongoose, { Schema, Document } from "mongoose";
import { UserOrganization as IUserOrganization } from "../types";

mongoose.pluralize(null);

export interface UserOrganizationDocument extends IUserOrganization, Document {}

const UserOrganizationSchema = new Schema<UserOrganizationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "organization",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "user", "viewer"],
      default: "user",
      index: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          "org:read",
          "org:write",
          "org:delete",
          "user:read",
          "user:write",
          "user:delete",
          "content:read",
          "content:write",
          "content:delete",
          "analytics:read",
          "reports:read",
          "reports:write",
          "payments:read",
          "payments:write",
        ],
      },
    ],
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
UserOrganizationSchema.index(
  { userId: 1, organizationId: 1 },
  { unique: true }
);
UserOrganizationSchema.index({ organizationId: 1, role: 1 });
UserOrganizationSchema.index({ userId: 1, isActive: 1 });

// Static method to get user's organizations
UserOrganizationSchema.statics.getUserOrganizations = async function (
  userId: string
) {
  return this.find({ userId, isActive: true })
    .populate("organizationId", "name subdomain status settings subscription")
    .sort({ joinedAt: -1 });
};

// Static method to get organization users
UserOrganizationSchema.statics.getOrganizationUsers = async function (
  organizationId: string
) {
  return this.find({ organizationId, isActive: true })
    .populate("userId", "displayName email photoURL role isActive")
    .sort({ joinedAt: -1 });
};

// Static method to check user access to organization
UserOrganizationSchema.statics.checkUserAccess = async function (
  userId: string,
  organizationId: string
) {
  return this.findOne({ userId, organizationId, isActive: true });
};

export const UserOrganization = mongoose.model<UserOrganizationDocument>(
  "userorganization",
  UserOrganizationSchema
);
