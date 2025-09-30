"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AuthService_1 = require("../services/AuthService");
const middleware_1 = require("../middleware");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const authService = new AuthService_1.AuthService();
// Register
router.post("/register", (0, middleware_1.validateRequest)(validation_1.registerSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");
    const result = await authService.register(req.body, ipAddress, userAgent);
    res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
    });
}));
// Login
router.post("/login", (0, middleware_1.validateRequest)(validation_1.loginSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");
    const result = await authService.login(req.body, ipAddress, userAgent);
    res.json({
        success: true,
        message: "Login successful",
        data: result,
    });
}));
// Refresh token
router.post("/refresh", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");
    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: "Refresh token required",
        });
    }
    const tokens = await authService.refreshToken(refreshToken, ipAddress, userAgent);
    res.json({
        success: true,
        message: "Token refreshed successfully",
        data: tokens,
    });
}));
// Logout
router.post("/logout", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);
    if (token) {
        await authService.logout(token);
    }
    res.json({
        success: true,
        message: "Logout successful",
    });
}));
// Logout all sessions
router.post("/logout-all", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await authService.logoutAll(req.user.userId);
    res.json({
        success: true,
        message: "All sessions logged out successfully",
    });
}));
// Change password
router.post("/change-password", middleware_1.authMiddleware, (0, middleware_1.validateRequest)(validation_1.changePasswordSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.userId, currentPassword, newPassword);
    res.json({
        success: true,
        message: "Password changed successfully",
    });
}));
// Get user profile
router.get("/profile", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const organizations = await authService.getUserOrganizations(req.user.userId);
    res.json({
        success: true,
        data: {
            user: req.user,
            organizations,
        },
    });
}));
// Verify token
router.get("/verify", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        data: req.user,
    });
}));
exports.default = router;
