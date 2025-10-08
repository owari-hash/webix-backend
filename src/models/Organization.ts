import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface OrganizationDocument extends Document {
  name: string;
  subdomain: string;
  domain?: string;
  status: "active" | "inactive" | "suspended" | "pending";
  settings: {
    theme: string;
    language: string;
    timezone: string;
    features: {
      webtoons: boolean;
      analytics: boolean;
      payments: boolean;
      notifications: boolean;
    };
  };
  subscription: {
    plan: "free" | "basic" | "professional" | "enterprise";
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<OrganizationDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
      index: true,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "pending",
      index: true,
    },
    settings: {
      theme: {
        type: String,
        default: "light",
      },
      language: {
        type: String,
        default: "mn",
      },
      timezone: {
        type: String,
        default: "Asia/Ulaanbaatar",
      },
      features: {
        webtoons: {
          type: Boolean,
          default: true,
        },
        analytics: {
          type: Boolean,
          default: true,
        },
        payments: {
          type: Boolean,
          default: true,
        },
        notifications: {
          type: Boolean,
          default: true,
        },
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "basic", "professional", "enterprise"],
        default: "free",
        index: true,
      },
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrganizationSchema.index({ subdomain: 1 });
OrganizationSchema.index({ domain: 1 });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ "subscription.plan": 1 });
OrganizationSchema.index({ createdAt: -1 });

// Virtual for checking if organization is active
OrganizationSchema.virtual("isActive").get(function () {
  return this.status === "active" && this.subscription.isActive;
});

// Static method to check subdomain availability
OrganizationSchema.statics.checkSubdomainAvailability = async function (
  subdomain: string
): Promise<boolean> {
  const existing = await this.findOne({ subdomain });
  return !existing;
};

// Static method to get organization by subdomain
OrganizationSchema.statics.getBySubdomain = async function (
  subdomain: string
): Promise<OrganizationDocument | null> {
  return this.findOne({ subdomain, status: "active" });
};

export const Organization = mongoose.model<OrganizationDocument>(
  "organization",
  OrganizationSchema
);
