import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Session } from "../models/Session";
import { UserOrganization } from "../models/UserOrganization";
import { AuditLog } from "../models/AuditLog";
import { RegisterDto, LoginDto, AuthResponse, TokenPair } from "../types";

export class AuthService {
  async register(
    userData: RegisterDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create user
    const user = new User({
      ...userData,
      passwordHash: userData.password, // Will be hashed by pre-save middleware
    });

    await user.save();

    // Generate tokens
    const tokens = user.generateTokens();

    // Create session
    await Session.createSession(user._id, tokens, ipAddress, userAgent);

    // Log registration
    await AuditLog.logAction({
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

  async login(
    loginData: LoginDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    // Find user with password hash
    const user = await User.findOne({ email: loginData.email }).select(
      "+passwordHash"
    );
    if (!user || !user.isActive) {
      throw new Error("Invalid credentials");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(loginData.password);
    if (!isPasswordValid) {
      // Log failed login attempt
      await AuditLog.logAction({
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
    await Session.createSession(user._id, tokens, ipAddress, userAgent);

    // Log successful login
    await AuditLog.logAction({
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

  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      ) as any;

      // Find valid session
      const session = await Session.findValidSession(refreshToken);
      if (!session) {
        throw new Error("Invalid refresh token");
      }

      // Check if user is still active
      if (!session.userId.isActive) {
        throw new Error("User account is inactive");
      }

      // Generate new tokens
      const user = await User.findById(session.userId._id);
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
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  async logout(accessToken: string): Promise<void> {
    await Session.revokeSession(accessToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await Session.revokeAllUserSessions(userId);
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      // Find valid session
      const session = await Session.findValidSession(token);
      if (!session) {
        throw new Error("Invalid token");
      }

      return {
        userId: session.userId._id,
        email: session.userId.email,
        role: session.userId.role,
        isActive: session.userId.isActive,
      };
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select("+passwordHash");
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
    await Session.revokeAllUserSessions(userId);

    // Log password change
    await AuditLog.logAction({
      userId,
      action: "password_changed",
      resource: "user",
      resourceId: userId,
    });
  }

  async getUserOrganizations(userId: string) {
    return UserOrganization.getUserOrganizations(userId);
  }

  async checkOrganizationAccess(userId: string, organizationId: string) {
    return UserOrganization.checkUserAccess(userId, organizationId);
  }
}
