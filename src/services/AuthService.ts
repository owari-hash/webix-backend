import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Session } from "../models/Session";
import { UserOrganization } from "../models/UserOrganization";
import { AuditLog } from "../models/AuditLog";
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  TokenPair,
  UserResponse,
} from "../types";

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
    const session = new Session({
      userId: user._id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
    });
    await session.save();

    // Log registration
    const auditLog = new AuditLog({
      userId: user._id,
      action: "user_registered",
      resource: "user",
      resourceId: user._id,
      ipAddress,
      userAgent,
    });
    await auditLog.save();

    const userResponse: UserResponse = {
      _id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.role,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: userResponse,
      ...tokens,
    };
  }

  async login(
    loginData: LoginDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    // Find user
    const user = await User.findOne({ email: loginData.email }).select(
      "+passwordHash"
    );
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(loginData.password);
    if (!isPasswordValid) {
      // Log failed login attempt
      const auditLog = new AuditLog({
        userId: user._id,
        action: "login_failed",
        resource: "user",
        resourceId: user._id,
        metadata: { reason: "invalid_password" },
        ipAddress,
        userAgent,
      });
      await auditLog.save();
      throw new Error("Invalid credentials");
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = user.generateTokens();

    // Create session
    const session = new Session({
      userId: user._id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
    });
    await session.save();

    // Log successful login
    const auditLog = new AuditLog({
      userId: user._id,
      action: "login_success",
      resource: "user",
      resourceId: user._id,
      ipAddress,
      userAgent,
    });
    await auditLog.save();

    const userResponse: UserResponse = {
      _id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.role,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: userResponse,
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
      const session = await Session.findOne({
        refreshToken,
        expiresAt: { $gt: new Date() },
        isActive: true,
      });
      if (!session) {
        throw new Error("Invalid refresh token");
      }

      // Check if user is still active
      const user = await User.findById(session.userId);
      if (!user || !user.isActive) {
        throw new Error("User account is inactive");
      }

      const tokens = user.generateTokens();

      // Update session with new tokens
      session.set("accessToken", tokens.accessToken);
      session.set("refreshToken", tokens.refreshToken);
      session.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await session.save();

      return tokens;
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  async logout(accessToken: string): Promise<void> {
    await Session.updateOne(
      { accessToken },
      { isActive: false, revokedAt: new Date() }
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await Session.updateMany(
      { userId },
      { isActive: false, revokedAt: new Date() }
    );
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      // Find valid session
      const session = await Session.findOne({
        accessToken: token,
        expiresAt: { $gt: new Date() },
        isActive: true,
      });
      if (!session) {
        throw new Error("Invalid token");
      }

      // Get user details
      const user = await User.findById(session.userId);
      if (!user) {
        throw new Error("User not found");
      }

      return {
        userId: user._id,
        email: user.email,
        role: user.role,
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
    await Session.updateMany(
      { userId },
      { isActive: false, revokedAt: new Date() }
    );

    // Log password change
    const auditLog = new AuditLog({
      userId,
      action: "password_changed",
      resource: "user",
      resourceId: userId,
    });
    await auditLog.save();
  }

  async getUserOrganizations(userId: string) {
    return UserOrganization.find({ userId }).populate("organizationId");
  }

  async checkOrganizationAccess(userId: string, organizationId: string) {
    const userOrg = await UserOrganization.findOne({ userId, organizationId });
    return !!userOrg;
  }
}
