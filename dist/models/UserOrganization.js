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
exports.UserOrganization = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const UserOrganizationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
// Compound indexes
UserOrganizationSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
UserOrganizationSchema.index({ organizationId: 1, role: 1 });
UserOrganizationSchema.index({ userId: 1, isActive: 1 });
// Static method to get user's organizations
UserOrganizationSchema.statics.getUserOrganizations = async function (userId) {
    return this.find({ userId, isActive: true })
        .populate("organizationId", "name subdomain status settings subscription")
        .sort({ joinedAt: -1 });
};
// Static method to get organization users
UserOrganizationSchema.statics.getOrganizationUsers = async function (organizationId) {
    return this.find({ organizationId, isActive: true })
        .populate("userId", "displayName email photoURL role isActive")
        .sort({ joinedAt: -1 });
};
// Static method to check user access to organization
UserOrganizationSchema.statics.checkUserAccess = async function (userId, organizationId) {
    return this.findOne({ userId, organizationId, isActive: true });
};
exports.UserOrganization = mongoose_1.default.model("userorganization", UserOrganizationSchema);
