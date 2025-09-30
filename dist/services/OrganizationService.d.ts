import { CreateOrganizationDto, PaginatedResponse } from "../types";
export declare class OrganizationService {
    createOrganization(orgData: CreateOrganizationDto, userId: string): Promise<any>;
    getOrganizationById(organizationId: string): Promise<any>;
    getOrganizationBySubdomain(subdomain: string): Promise<any>;
    updateOrganization(organizationId: string, updateData: Partial<CreateOrganizationDto>, userId: string): Promise<any>;
    deleteOrganization(organizationId: string, userId: string): Promise<void>;
    getOrganizations(page?: number, limit?: number, search?: string): Promise<PaginatedResponse<any>>;
    addUserToOrganization(organizationId: string, userEmail: string, role: string, permissions: string[], addedBy: string): Promise<any>;
    removeUserFromOrganization(organizationId: string, userId: string, removedBy: string): Promise<void>;
    updateUserRole(organizationId: string, userId: string, role: string, permissions: string[], updatedBy: string): Promise<any>;
    getOrganizationUsers(organizationId: string, page?: number, limit?: number): Promise<PaginatedResponse<any>>;
    checkSubdomainAvailability(subdomain: string): Promise<boolean>;
}
//# sourceMappingURL=OrganizationService.d.ts.map