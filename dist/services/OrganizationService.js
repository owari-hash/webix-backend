"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
const Organization_1 = require("../models/Organization");
const UserOrganization_1 = require("../models/UserOrganization");
const User_1 = require("../models/User");
const AuditLog_1 = require("../models/AuditLog");
class OrganizationService {
    async createOrganization(orgData, userId) {
        // Check subdomain availability
        const isAvailable = await Organization_1.Organization.checkSubdomainAvailability(orgData.subdomain);
        if (!isAvailable) {
            throw new Error("Subdomain already exists");
        }
        // Create organization
        const organization = new Organization_1.Organization(orgData);
        await organization.save();
        // Add creator as admin
        await UserOrganization_1.UserOrganization.create({
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
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId: organization._id,
            action: "organization_created",
            resource: "organization",
            resourceId: organization._id,
        });
        return organization;
    }
    async getOrganizationById(organizationId) {
        const organization = await Organization_1.Organization.findById(organizationId);
        if (!organization) {
            throw new Error("Organization not found");
        }
        return organization;
    }
    async getOrganizationBySubdomain(subdomain) {
        const organization = await Organization_1.Organization.getBySubdomain(subdomain);
        if (!organization) {
            throw new Error("Organization not found");
        }
        return organization;
    }
    async updateOrganization(organizationId, updateData, userId) {
        const organization = await Organization_1.Organization.findById(organizationId);
        if (!organization) {
            throw new Error("Organization not found");
        }
        // Check if subdomain is being changed
        if (updateData.subdomain &&
            updateData.subdomain !== organization.subdomain) {
            const isAvailable = await Organization_1.Organization.checkSubdomainAvailability(updateData.subdomain);
            if (!isAvailable) {
                throw new Error("Subdomain already exists");
            }
        }
        Object.assign(organization, updateData);
        await organization.save();
        // Log organization update
        await AuditLog_1.AuditLog.logAction({
            userId,
            organizationId,
            action: "organization_updated",
            resource: "organization",
            resourceId: organizationId,
        });
        return organization;
    }
    async deleteOrganization(organizationId, userId) {
        const organization = await Organization_1.Organization.findById(organizationId);
        if (!organization) {
            throw new Error("Organization not found");
        }
        // Check if there are any users in the organization
        const userCount = await UserOrganization_1.UserOrganization.countDocuments({ organizationId });
        if (userCount > 0) {
            throw new Error("Cannot delete organization with existing users");
        }
        await Organization_1.Organization.findByIdAndDelete(organizationId);
        // Log organization deletion
        await AuditLog_1.AuditLog.logAction({
            userId,
            action: "organization_deleted",
            resource: "organization",
            resourceId: organizationId,
        });
    }
    async getOrganizations(page = 1, limit = 20, search) {
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { subdomain: { $regex: search, $options: "i" } },
            ];
        }
        const skip = (page - 1) * limit;
        const organizations = await Organization_1.Organization.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await Organization_1.Organization.countDocuments(query);
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
    async addUserToOrganization(organizationId, userEmail, role, permissions, addedBy) {
        // Find user by email
        const user = await User_1.User.findOne({ email: userEmail });
        if (!user) {
            throw new Error("User not found");
        }
        // Check if user is already in organization
        const existingMembership = await UserOrganization_1.UserOrganization.findOne({
            userId: user._id,
            organizationId,
        });
        if (existingMembership) {
            throw new Error("User is already a member of this organization");
        }
        // Add user to organization
        const userOrg = new UserOrganization_1.UserOrganization({
            userId: user._id,
            organizationId,
            role,
            permissions,
        });
        await userOrg.save();
        // Log user addition
        await AuditLog_1.AuditLog.logAction({
            userId: addedBy,
            organizationId,
            action: "user_added_to_organization",
            resource: "user_organization",
            resourceId: userOrg._id,
            metadata: { addedUserId: user._id, role, permissions },
        });
        return userOrg;
    }
    async removeUserFromOrganization(organizationId, userId, removedBy) {
        const userOrg = await UserOrganization_1.UserOrganization.findOne({ userId, organizationId });
        if (!userOrg) {
            throw new Error("User is not a member of this organization");
        }
        await UserOrganization_1.UserOrganization.findByIdAndDelete(userOrg._id);
        // Log user removal
        await AuditLog_1.AuditLog.logAction({
            userId: removedBy,
            organizationId,
            action: "user_removed_from_organization",
            resource: "user_organization",
            resourceId: userOrg._id,
            metadata: { removedUserId: userId },
        });
    }
    async updateUserRole(organizationId, userId, role, permissions, updatedBy) {
        const userOrg = await UserOrganization_1.UserOrganization.findOne({ userId, organizationId });
        if (!userOrg) {
            throw new Error("User is not a member of this organization");
        }
        userOrg.role = role;
        userOrg.permissions = permissions;
        await userOrg.save();
        // Log role update
        await AuditLog_1.AuditLog.logAction({
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
    async getOrganizationUsers(organizationId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const userOrgs = await UserOrganization_1.UserOrganization.find({
            organizationId,
            isActive: true,
        })
            .populate("userId", "displayName email photoURL role isActive")
            .sort({ joinedAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await UserOrganization_1.UserOrganization.countDocuments({
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
    async checkSubdomainAvailability(subdomain) {
        return Organization_1.Organization.checkSubdomainAvailability(subdomain);
    }
}
exports.OrganizationService = OrganizationService;
