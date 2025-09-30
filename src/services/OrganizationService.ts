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
    const isAvailable = await Organization.checkSubdomainAvailability(
      orgData.subdomain
    );
    if (!isAvailable) {
      throw new Error("Subdomain already exists");
    }

    // Create organization
    const organization = new Organization(orgData);
    await organization.save();

    // Add creator as admin
    await UserOrganization.create({
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

    // Log organization creation
    await AuditLog.logAction({
      userId,
      organizationId: organization._id,
      action: "organization_created",
      resource: "organization",
      resourceId: organization._id,
    });

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
    const organization = await Organization.getBySubdomain(subdomain);
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

    // Check if subdomain is being changed
    if (
      updateData.subdomain &&
      updateData.subdomain !== organization.subdomain
    ) {
      const isAvailable = await Organization.checkSubdomainAvailability(
        updateData.subdomain
      );
      if (!isAvailable) {
        throw new Error("Subdomain already exists");
      }
    }

    Object.assign(organization, updateData);
    await organization.save();

    // Log organization update
    await AuditLog.logAction({
      userId,
      organizationId,
      action: "organization_updated",
      resource: "organization",
      resourceId: organizationId,
    });

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

    // Check if there are any users in the organization
    const userCount = await UserOrganization.countDocuments({ organizationId });
    if (userCount > 0) {
      throw new Error("Cannot delete organization with existing users");
    }

    await Organization.findByIdAndDelete(organizationId);

    // Log organization deletion
    await AuditLog.logAction({
      userId,
      action: "organization_deleted",
      resource: "organization",
      resourceId: organizationId,
    });
  }

  async getOrganizations(
    page = 1,
    limit = 20,
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

  async addUserToOrganization(
    organizationId: string,
    userEmail: string,
    role: string,
    permissions: string[],
    addedBy: string
  ): Promise<any> {
    // Find user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is already in organization
    const existingMembership = await UserOrganization.findOne({
      userId: user._id,
      organizationId,
    });
    if (existingMembership) {
      throw new Error("User is already a member of this organization");
    }

    // Add user to organization
    const userOrg = new UserOrganization({
      userId: user._id,
      organizationId,
      role,
      permissions,
    });

    await userOrg.save();

    // Log user addition
    await AuditLog.logAction({
      userId: addedBy,
      organizationId,
      action: "user_added_to_organization",
      resource: "user_organization",
      resourceId: userOrg._id,
      metadata: { addedUserId: user._id, role, permissions },
    });

    return userOrg;
  }

  async removeUserFromOrganization(
    organizationId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    const userOrg = await UserOrganization.findOne({ userId, organizationId });
    if (!userOrg) {
      throw new Error("User is not a member of this organization");
    }

    await UserOrganization.findByIdAndDelete(userOrg._id);

    // Log user removal
    await AuditLog.logAction({
      userId: removedBy,
      organizationId,
      action: "user_removed_from_organization",
      resource: "user_organization",
      resourceId: userOrg._id,
      metadata: { removedUserId: userId },
    });
  }

  async updateUserRole(
    organizationId: string,
    userId: string,
    role: string,
    permissions: string[],
    updatedBy: string
  ): Promise<any> {
    const userOrg = await UserOrganization.findOne({ userId, organizationId });
    if (!userOrg) {
      throw new Error("User is not a member of this organization");
    }

    userOrg.role = role;
    userOrg.permissions = permissions;
    await userOrg.save();

    // Log role update
    await AuditLog.logAction({
      userId: updatedBy,
      organizationId,
      action: "user_role_updated",
      resource: "user_organization",
      resourceId: userOrg._id,
      metadata: {
        updatedUserId: userId,
        newRole: role,
        newPermissions: permissions,
      },
    });

    return userOrg;
  }

  async getOrganizationUsers(
    organizationId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;

    const userOrgs = await UserOrganization.find({
      organizationId,
      isActive: true,
    })
      .populate("userId", "displayName email photoURL role isActive")
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserOrganization.countDocuments({
      organizationId,
      isActive: true,
    });

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

  async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    return Organization.checkSubdomainAvailability(subdomain);
  }
}
