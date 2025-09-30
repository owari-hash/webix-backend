import mongoose, { Schema, Document } from "mongoose";
import { Session as ISession } from "../types";

mongoose.pluralize(null);

export interface SessionDocument extends ISession, Document {}

const SessionSchema = new Schema<SessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SessionSchema.index({ userId: 1 });
SessionSchema.index({ token: 1 });
SessionSchema.index({ refreshToken: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create session
SessionSchema.statics.createSession = async function (
  userId: string,
  tokens: { accessToken: string; refreshToken: string },
  ipAddress?: string,
  userAgent?: string
) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes for access token

  const session = new this({
    userId,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return session.save();
};

// Static method to find valid session
SessionSchema.statics.findValidSession = async function (token: string) {
  return this.findOne({
    token,
    expiresAt: { $gt: new Date() },
  }).populate("userId", "displayName email role isActive");
};

// Static method to revoke session
SessionSchema.statics.revokeSession = async function (token: string) {
  return this.deleteOne({ token });
};

// Static method to revoke all user sessions
SessionSchema.statics.revokeAllUserSessions = async function (userId: string) {
  return this.deleteMany({ userId });
};

export const Session = mongoose.model<SessionDocument>(
  "session",
  SessionSchema
);
