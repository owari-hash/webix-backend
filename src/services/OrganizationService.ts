import { Organization } from "../models/Organization";
import { UserOrganization } from "../models/UserOrganization";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { CreateOrganizationDto, PaginatedResponse } from "../types";

export class OrganizationService {
  async createOrganization(
    orgData: CreateOrganizationDto,
    userId: string
  ): Promise<any> {
    // Check subdomain availability
    const existingOrg = await Organization.findOne({
      subdomain: orgData.subdomain,
    });
    if (existingOrg) {
      throw new Error("Subdomain already exists");
    }

    // Create organization
    const organization = new Organization(orgData);
    await organization.save();

    // Add creator as admin
    const userOrg = new UserOrganization({
      userId,
      organizationId: organization._id,
      role: "admin",
      permissions: [
        "org:read",
        "org:write",
        "org:delete",
        "user:read",
        "user:write",
        "user:delete",
        "content:read",
        "content:write",
        "content:delete",
        "analytics:read",
        "reports:read",
        "reports:write",
        "payments:read",
        "payments:write",
      ],
    });
    await userOrg.save();

    // Log organization creation
    const auditLog = new AuditLog({
      userId,
      organizationId: organization._id,
      action: "organization_created",
      resource: "organization",
      resourceId: organization._id,
    });
    await auditLog.save();

    return organization;
  }

  async getOrganizationById(organizationId: string): Promise<any> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }
    return organization;
  }

  async getOrganizationBySubdomain(subdomain: string): Promise<any> {
    const organization = await Organization.findOne({ subdomain });
    if (!organization) {
      throw new Error("Organization not found");
    }
    return organization;
  }

  async updateOrganization(
    organizationId: string,
    updateData: Partial<CreateOrganizationDto>,
    userId: string
  ): Promise<any> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Check subdomain availability if changing subdomain
    if (
      updateData.subdomain &&
      updateData.subdomain !== organization.subdomain
    ) {
      const existingOrg = await Organization.findOne({
        subdomain: updateData.subdomain,
      });
      if (existingOrg) {
        throw new Error("Subdomain already exists");
      }
    }

    // Update organization
    Object.assign(organization, updateData);
    await organization.save();

    // Log organization update
    const auditLog = new AuditLog({
      userId,
      organizationId,
      action: "organization_updated",
      resource: "organization",
      resourceId: organizationId,
      metadata: { changes: updateData },
    });
    await auditLog.save();

    return organization;
  }

  async deleteOrganization(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Delete all user-organization relationships
    await UserOrganization.deleteMany({ organizationId });

    // Delete organization
    await Organization.findByIdAndDelete(organizationId);

    // Log organization deletion
    const auditLog = new AuditLog({
      userId,
      action: "organization_deleted",
      resource: "organization",
      resourceId: organizationId,
    });
    await auditLog.save();
  }

  async getOrganizations(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<PaginatedResponse<any>> {
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subdomain: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Organization.countDocuments(query);

    return {
      data: organizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getOrganizationUsers(
    organizationId: string,
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    const userOrgs = await UserOrganization.find({ organizationId })
      .populate("userId", "displayName email photoURL role isActive")
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserOrganization.countDocuments({ organizationId });

    return {
      data: userOrgs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async addUserToOrganization(
    organizationId: string,
    userEmail: string,
    role: "admin" | "moderator" | "user" | "viewer",
    addedBy: string
  ): Promise<any> {
    // Find user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is already in organization
    const existingUserOrg = await UserOrganization.findOne({
      userId: user._id,
      organizationId,
    });
    if (existingUserOrg) {
      throw new Error("User is already in this organization");
    }

    // Add user to organization
    const userOrg = new UserOrganization({
      userId: user._id,
      organizationId,
      role,
      permissions: this.getDefaultPermissions(role),
    });
    await userOrg.save();

    // Log user addition
    const auditLog = new AuditLog({
      userId: addedBy,
      organizationId,
      action: "user_added_to_organization",
      resource: "user",
      resourceId: user._id,
      metadata: { role, userEmail },
    });
    await auditLog.save();

    return userOrg;
  }

  async removeUserFromOrganization(
    organizationId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    const userOrg = await UserOrganization.findOne({
      userId,
      organizationId,
    });
    if (!userOrg) {
      throw new Error("User is not in this organization");
    }

    await UserOrganization.findByIdAndDelete(userOrg._id);

    // Log user removal
    const auditLog = new AuditLog({
      userId: removedBy,
      organizationId,
      action: "user_removed_from_organization",
      resource: "user",
      resourceId: userId,
    });
    await auditLog.save();
  }

  async updateUserRole(
    organizationId: string,
    userId: string,
    role: "admin" | "moderator" | "user" | "viewer",
    updatedBy: string
  ): Promise<any> {
    const userOrg = await UserOrganization.findOne({
      userId,
      organizationId,
    });
    if (!userOrg) {
      throw new Error("User is not in this organization");
    }

    userOrg.role = role;
    userOrg.permissions = this.getDefaultPermissions(role);
    await userOrg.save();

    // Log role update
    const auditLog = new AuditLog({
      userId: updatedBy,
      organizationId,
      action: "user_role_updated",
      resource: "user",
      resourceId: userId,
      metadata: { newRole: role },
    });
    await auditLog.save();

    return userOrg;
  }

  private getDefaultPermissions(role: string): string[] {
    const permissions: { [key: string]: string[] } = {
      admin: [
        "org:read",
        "org:write",
        "org:delete",
        "user:read",
        "user:write",
        "user:delete",
        "content:read",
        "content:write",
        "content:delete",
        "analytics:read",
        "reports:read",
        "reports:write",
        "payments:read",
        "payments:write",
      ],
      moderator: [
        "org:read",
        "user:read",
        "user:write",
        "content:read",
        "content:write",
        "content:delete",
        "analytics:read",
        "reports:read",
      ],
      user: ["org:read", "content:read", "content:write", "analytics:read"],
      viewer: ["org:read", "content:read", "analytics:read"],
    };

    return permissions[role] || [];
  }

  async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    const existingOrg = await Organization.findOne({ subdomain });
    return !existingOrg;
  }
}
