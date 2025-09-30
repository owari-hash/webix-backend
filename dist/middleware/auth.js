"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminMiddleware = exports.permissionMiddleware = exports.roleMiddleware = exports.organizationAccessMiddleware = exports.authMiddleware = void 0;
const AuthService_1 = require("../services/AuthService");
const OrganizationService_1 = require("../services/OrganizationService");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
            });
        }
        const token = authHeader.substring(7);
        const authService = new AuthService_1.AuthService();
        const user = await authService.verifyToken(token);
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid token",
        });
    }
};
exports.authMiddleware = authMiddleware;
const organizationAccessMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        const organizationId = req.params.organizationId || req.body.organizationId;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "Organization ID required",
            });
        }
        const authService = new AuthService_1.AuthService();
        const userOrg = await authService.checkOrganizationAccess(req.user.userId, organizationId);
        if (!userOrg) {
            return res.status(403).json({
                success: false,
                message: "Access denied to organization",
            });
        }
        req.userOrganization = userOrg;
        // Get organization details
        const orgService = new OrganizationService_1.OrganizationService();
        const organization = await orgService.getOrganizationById(organizationId);
        req.organization = organization;
        next();
    }
    catch (error) {
        return res.status(403).json({
            success: false,
            message: "Access denied to organization",
        });
    }
};
exports.organizationAccessMiddleware = organizationAccessMiddleware;
const roleMiddleware = (requiredRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        if (!requiredRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions",
            });
        }
        next();
    };
};
exports.roleMiddleware = roleMiddleware;
const permissionMiddleware = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.userOrganization) {
            return res.status(403).json({
                success: false,
                message: "Organization access required",
            });
        }
        const userPermissions = req.userOrganization.permissions || [];
        const hasPermission = requiredPermissions.some((permission) => userPermissions.includes(permission));
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions",
            });
        }
        next();
    };
};
exports.permissionMiddleware = permissionMiddleware;
const superAdminMiddleware = (req, res, next) => {
    if (!req.user || req.user.role !== "super_admin") {
        return res.status(403).json({
            success: false,
            message: "Super admin access required",
        });
    }
    next();
};
exports.superAdminMiddleware = superAdminMiddleware;
