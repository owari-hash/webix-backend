import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

mongoose.pluralize(null);

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  photoURL?: string;
  role: "super_admin" | "org_admin" | "org_moderator" | "org_user" | "viewer";
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  generateTokens(): { accessToken: string; refreshToken: string };
}

const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    photoURL: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "org_admin", "org_moderator", "org_user", "viewer"],
      default: "org_user",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.twoFactorSecret;
        return ret;
      },
    },
  }
);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware
UserSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance methods
UserSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.methods.generateTokens = function (): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = jwt.sign(
    {
      userId: this._id,
      email: this.email,
      role: this.role,
      type: "access",
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    {
      userId: this._id,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

// Create default super admin if no users exist
UserSchema.statics.createDefaultAdmin = async function () {
  const count = await this.estimatedDocumentCount();

  if (count === 0) {
    const admin = new this({
      email: "admin@webix.mn",
      passwordHash: "admin123", // Will be hashed by pre-save middleware
      displayName: "Super Admin",
      role: "super_admin",
      isActive: true,
    });

    await admin.save();
    console.log("Default super admin created");
  }
};

export const User = mongoose.model<UserDocument>("user", UserSchema);
