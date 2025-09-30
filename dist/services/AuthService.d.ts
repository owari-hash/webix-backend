import { RegisterDto, LoginDto, AuthResponse, TokenPair } from "../types";
export declare class AuthService {
    register(userData: RegisterDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse>;
    login(loginData: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse>;
    refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<TokenPair>;
    logout(accessToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    verifyToken(token: string): Promise<any>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    getUserOrganizations(userId: string): Promise<any>;
    checkOrganizationAccess(userId: string, organizationId: string): Promise<any>;
}
//# sourceMappingURL=AuthService.d.ts.map