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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
mongoose_1.default.pluralize(null);
const UserSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.passwordHash;
            delete ret.twoFactorSecret;
            return ret;
        },
    },
});
// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });
// Pre-save middleware
UserSchema.pre("save", async function (next) {
    if (!this.isModified("passwordHash"))
        return next();
    try {
        const salt = await bcrypt_1.default.genSalt(12);
        this.passwordHash = await bcrypt_1.default.hash(this.passwordHash, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
// Instance methods
UserSchema.methods.comparePassword = async function (password) {
    return bcrypt_1.default.compare(password, this.passwordHash);
};
UserSchema.methods.generateTokens = function () {
    const accessToken = jsonwebtoken_1.default.sign({
        userId: this._id,
        email: this.email,
        role: this.role,
        type: "access",
    }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jsonwebtoken_1.default.sign({
        userId: this._id,
        type: "refresh",
    }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
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
exports.User = mongoose_1.default.model("user", UserSchema);
