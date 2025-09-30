import express from "express";
import { AuthService } from "../services/AuthService";
import { authMiddleware, validateRequest } from "../middleware";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const authService = new AuthService();

// Register
router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");

    const result = await authService.register(req.body, ipAddress, userAgent);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  })
);

// Login
router.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");

    const result = await authService.login(req.body, ipAddress, userAgent);

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  })
);

// Refresh token
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const tokens = await authService.refreshToken(
      refreshToken,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: tokens,
    });
  })
);

// Logout
router.post(
  "/logout",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    if (token) {
      await authService.logout(token);
    }

    res.json({
      success: true,
      message: "Logout successful",
    });
  })
);

// Logout all sessions
router.post(
  "/logout-all",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user!.userId);

    res.json({
      success: true,
      message: "All sessions logged out successfully",
    });
  })
);

// Change password
router.post(
  "/change-password",
  authMiddleware,
  validateRequest(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(
      req.user!.userId,
      currentPassword,
      newPassword
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  })
);

// Get user profile
router.get(
  "/profile",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const organizations = await authService.getUserOrganizations(
      req.user!.userId
    );

    res.json({
      success: true,
      data: {
        user: req.user,
        organizations,
      },
    });
  })
);

// Verify token
router.get(
  "/verify",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: req.user,
    });
  })
);

export default router;
