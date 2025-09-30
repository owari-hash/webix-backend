"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const OrganizationService_1 = require("../services/OrganizationService");
const middleware_1 = require("../middleware");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const organizationService = new OrganizationService_1.OrganizationService();
// Create organization
router.post("/", middleware_1.authMiddleware, (0, middleware_1.validateRequest)(validation_1.createOrganizationSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const organization = await organizationService.createOrganization(req.body, req.user.userId);
    res.status(201).json({
        success: true,
        message: "Organization created successfully",
        data: organization,
    });
}));
// Get all organizations (for super admin)
router.get("/", middleware_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const result = await organizationService.getOrganizations(Number(page), Number(limit), search);
    res.json({
        success: true,
        data: result,
    });
}));
// Get organization by ID
router.get("/:organizationId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        data: req.organization,
    });
}));
// Get organization by subdomain
router.get("/subdomain/:subdomain", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const organization = await organizationService.getOrganizationBySubdomain(req.params.subdomain);
    res.json({
        success: true,
        data: organization,
    });
}));
// Update organization
router.put("/:organizationId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["org:write"]), (0, middleware_1.validateRequest)(validation_1.createOrganizationSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const organization = await organizationService.updateOrganization(req.params.organizationId, req.body, req.user.userId);
    res.json({
        success: true,
        message: "Organization updated successfully",
        data: organization,
    });
}));
// Delete organization
router.delete("/:organizationId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["org:delete"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await organizationService.deleteOrganization(req.params.organizationId, req.user.userId);
    res.json({
        success: true,
        message: "Organization deleted successfully",
    });
}));
// Check subdomain availability
router.get("/check-subdomain/:subdomain", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const isAvailable = await organizationService.checkSubdomainAvailability(req.params.subdomain);
    res.json({
        success: true,
        data: { available: isAvailable },
    });
}));
// Add user to organization
router.post("/:organizationId/users", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["user:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userEmail, role, permissions } = req.body;
    const userOrg = await organizationService.addUserToOrganization(req.params.organizationId, userEmail, role, permissions, req.user.userId);
    res.status(201).json({
        success: true,
        message: "User added to organization successfully",
        data: userOrg,
    });
}));
// Get organization users
router.get("/:organizationId/users", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["user:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await organizationService.getOrganizationUsers(req.params.organizationId, Number(page), Number(limit));
    res.json({
        success: true,
        data: result,
    });
}));
// Remove user from organization
router.delete("/:organizationId/users/:userId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["user:delete"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await organizationService.removeUserFromOrganization(req.params.organizationId, req.params.userId, req.user.userId);
    res.json({
        success: true,
        message: "User removed from organization successfully",
    });
}));
// Update user role in organization
router.put("/:organizationId/users/:userId/role", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["user:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { role, permissions } = req.body;
    const userOrg = await organizationService.updateUserRole(req.params.organizationId, req.params.userId, role, permissions, req.user.userId);
    res.json({
        success: true,
        message: "User role updated successfully",
        data: userOrg,
    });
}));
exports.default = router;
