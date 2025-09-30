"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Organization = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const OrganizationSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
});
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
OrganizationSchema.statics.checkSubdomainAvailability = async function (subdomain) {
    const existing = await this.findOne({ subdomain });
    return !existing;
};
// Static method to get organization by subdomain
OrganizationSchema.statics.getBySubdomain = async function (subdomain) {
    return this.findOne({ subdomain, status: "active" });
};
exports.Organization = mongoose_1.default.model("organization", OrganizationSchema);
