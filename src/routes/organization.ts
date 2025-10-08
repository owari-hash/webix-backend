import express from "express";
import { OrganizationService } from "../services/OrganizationService";
import {
  authMiddleware,
  organizationAccessMiddleware,
  validateRequest,
  permissionMiddleware,
} from "../middleware";
import { createOrganizationSchema } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const organizationService = new OrganizationService();

// Create organization
router.post(
  "/",
  authMiddleware,
  validateRequest(createOrganizationSchema),
  asyncHandler(async (req, res) => {
    const organization = await organizationService.createOrganization(
      req.body,
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: organization,
    });
  })
);

// Get all organizations (for super admin)
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;

    const result = await organizationService.getOrganizations(
      Number(page),
      Number(limit),
      search as string
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get organization by ID
router.get(
  "/:organizationId",
  authMiddleware,
  organizationAccessMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: req.organization,
    });
  })
);

// Get organization by subdomain
router.get(
  "/subdomain/:subdomain",
  asyncHandler(async (req, res) => {
    const organization = await organizationService.getOrganizationBySubdomain(
      req.params.subdomain
    );

    res.json({
      success: true,
      data: organization,
    });
  })
);

// Update organization
router.put(
  "/:organizationId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["org:write"]),
  validateRequest(createOrganizationSchema),
  asyncHandler(async (req, res) => {
    const organization = await organizationService.updateOrganization(
      req.params.organizationId,
      req.body,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Organization updated successfully",
      data: organization,
    });
  })
);

// Delete organization
router.delete(
  "/:organizationId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["org:delete"]),
  asyncHandler(async (req, res) => {
    await organizationService.deleteOrganization(
      req.params.organizationId,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "Organization deleted successfully",
    });
  })
);

// Check subdomain availability
router.get(
  "/check-subdomain/:subdomain",
  asyncHandler(async (req, res) => {
    const isAvailable = await organizationService.checkSubdomainAvailability(
      req.params.subdomain
    );

    res.json({
      success: true,
      data: { available: isAvailable },
    });
  })
);

// Add user to organization
router.post(
  "/:organizationId/users",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["user:write"]),
  asyncHandler(async (req, res) => {
    const { userEmail, role, permissions } = req.body;

    const userOrg = await organizationService.addUserToOrganization(
      req.params.organizationId,
      userEmail,
      role,
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      message: "User added to organization successfully",
      data: userOrg,
    });
  })
);

// Get organization users
router.get(
  "/:organizationId/users",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["user:read"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const result = await organizationService.getOrganizationUsers(
      req.params.organizationId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Remove user from organization
router.delete(
  "/:organizationId/users/:userId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["user:delete"]),
  asyncHandler(async (req, res) => {
    await organizationService.removeUserFromOrganization(
      req.params.organizationId,
      req.params.userId,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "User removed from organization successfully",
    });
  })
);

// Update user role in organization
router.put(
  "/:organizationId/users/:userId/role",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["user:write"]),
  asyncHandler(async (req, res) => {
    const { role, permissions } = req.body;

    const userOrg = await organizationService.updateUserRole(
      req.params.organizationId,
      req.params.userId,
      role,
      req.user!.userId
    );

    res.json({
      success: true,
      message: "User role updated successfully",
      data: userOrg,
    });
  })
);

export default router;
