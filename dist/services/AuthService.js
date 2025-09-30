"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Session_1 = require("../models/Session");
const UserOrganization_1 = require("../models/UserOrganization");
const AuditLog_1 = require("../models/AuditLog");
class AuthService {
    async register(userData, ipAddress, userAgent) {
        // Check if user already exists
        const existingUser = await User_1.User.findOne({ email: userData.email });
        if (existingUser) {
            throw new Error("User with this email already exists");
        }
        // Create user
        const user = new User_1.User({
            ...userData,
            passwordHash: userData.password, // Will be hashed by pre-save middleware
        });
        await user.save();
        // Generate tokens
        const tokens = user.generateTokens();
        // Create session
        await Session_1.Session.createSession(user._id, tokens, ipAddress, userAgent);
        // Log registration
        await AuditLog_1.AuditLog.logAction({
            userId: user._id,
            action: "user_registered",
            resource: "user",
            resourceId: user._id,
            ipAddress,
            userAgent,
        });
        return {
            user: user.toJSON(),
            ...tokens,
        };
    }
    async login(loginData, ipAddress, userAgent) {
        // Find user with password hash
        const user = await User_1.User.findOne({ email: loginData.email }).select("+passwordHash");
        if (!user || !user.isActive) {
            throw new Error("Invalid credentials");
        }
        // Check password
        const isPasswordValid = await user.comparePassword(loginData.password);
        if (!isPasswordValid) {
            // Log failed login attempt
            await AuditLog_1.AuditLog.logAction({
                userId: user._id,
                action: "login_failed",
                resource: "user",
                resourceId: user._id,
                metadata: { reason: "invalid_password" },
                ipAddress,
                userAgent,
            });
            throw new Error("Invalid credentials");
        }
        // Update last login
        user.lastLoginAt = new Date();
        await user.save();
        // Generate tokens
        const tokens = user.generateTokens();
        // Create session
        await Session_1.Session.createSession(user._id, tokens, ipAddress, userAgent);
        // Log successful login
        await AuditLog_1.AuditLog.logAction({
            userId: user._id,
            action: "login_success",
            resource: "user",
            resourceId: user._id,
            ipAddress,
            userAgent,
        });
        return {
            user: user.toJSON(),
            ...tokens,
        };
    }
    async refreshToken(refreshToken, ipAddress, userAgent) {
        try {
            // Verify refresh token
            const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            // Find valid session
            const session = await Session_1.Session.findValidSession(refreshToken);
            if (!session) {
                throw new Error("Invalid refresh token");
            }
            // Check if user is still active
            if (!session.userId.isActive) {
                throw new Error("User account is inactive");
            }
            // Generate new tokens
            const user = await User_1.User.findById(session.userId._id);
            if (!user) {
                throw new Error("User not found");
            }
            const tokens = user.generateTokens();
            // Update session with new tokens
            session.token = tokens.accessToken;
            session.refreshToken = tokens.refreshToken;
            session.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            await session.save();
            return tokens;
        }
        catch (error) {
            throw new Error("Invalid refresh token");
        }
    }
    async logout(accessToken) {
        await Session_1.Session.revokeSession(accessToken);
    }
    async logoutAll(userId) {
        await Session_1.Session.revokeAllUserSessions(userId);
    }
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // Find valid session
            const session = await Session_1.Session.findValidSession(token);
            if (!session) {
                throw new Error("Invalid token");
            }
            return {
                userId: session.userId._id,
                email: session.userId.email,
                role: session.userId.role,
                isActive: session.userId.isActive,
            };
        }
        catch (error) {
            throw new Error("Invalid token");
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await User_1.User.findById(userId).select("+passwordHash");
        if (!user) {
            throw new Error("User not found");
        }
        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            throw new Error("Current password is incorrect");
        }
        // Update password
        user.passwordHash = newPassword; // Will be hashed by pre-save middleware
        await user.save();
        // Revoke all sessions except current one
        await Session_1.Session.revokeAllUserSessions(userId);
        // Log password change
        await AuditLog_1.AuditLog.logAction({
            userId,
            action: "password_changed",
            resource: "user",
            resourceId: userId,
        });
    }
    async getUserOrganizations(userId) {
        return UserOrganization_1.UserOrganization.getUserOrganizations(userId);
    }
    async checkOrganizationAccess(userId, organizationId) {
        return UserOrganization_1.UserOrganization.checkUserAccess(userId, organizationId);
    }
}
exports.AuthService = AuthService;
