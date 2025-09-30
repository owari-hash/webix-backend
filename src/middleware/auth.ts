import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/AuthService";
import { OrganizationService } from "../services/OrganizationService";

// Extend Request interface to include user and organization
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        isActive: boolean;
      };
      userOrganization?: any;
      organization?: any;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.substring(7);
    const authService = new AuthService();

    const user = await authService.verifyToken(token);
    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

export const organizationAccessMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    const authService = new AuthService();
    const userOrg = await authService.checkOrganizationAccess(
      req.user.userId,
      organizationId
    );

    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: "Access denied to organization",
      });
    }

    req.userOrganization = userOrg;

    // Get organization details
    const orgService = new OrganizationService();
    const organization = await orgService.getOrganizationById(organizationId);
    req.organization = organization;

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Access denied to organization",
    });
  }
};

export const roleMiddleware = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

export const permissionMiddleware = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userOrganization) {
      return res.status(403).json({
        success: false,
        message: "Organization access required",
      });
    }

    const userPermissions = req.userOrganization.permissions || [];
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

export const superAdminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Super admin access required",
    });
  }
  next();
};
