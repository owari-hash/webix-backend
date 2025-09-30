import { Request, Response, NextFunction } from "express";
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
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const organizationAccessMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const roleMiddleware: (requiredRoles: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const permissionMiddleware: (requiredPermissions: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const superAdminMiddleware: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map