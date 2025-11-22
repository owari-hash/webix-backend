const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const router = express.Router();

// @route   GET /api2/organizations/license
// @desc    Get current organization license info
// @access  Public (or Private if you want to restrict)
router.get("/license", async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne(
      { subdomain },
      { projection: { subscription: 1, name: 1, displayName: 1 } }
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Calculate endDate if not present (default to 30 days from startDate)
    let subscription = { ...organization.subscription };
    if (!subscription.endDate && subscription.startDate) {
      const startDate = new Date(subscription.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 30);
      subscription.endDate = endDate;
    }

    console.log('License Request - Subdomain:', subdomain);
    console.log('License Request - Organization found:', organization ? 'Yes' : 'No');
    if (organization) {
      console.log('License Request - Subscription:', organization.subscription);
    }

    res.json({
      success: true,
      data: {
        subscription: subscription,
        name: organization.name,
        displayName: organization.displayName,
      },
    });
  } catch (error) {
    console.error("Get license info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get license info",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations/current
// @desc    Get current organization (based on subdomain)
// @access  Private
router.get("/current", authenticate, async (req, res) => {
  try {
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne({
      subdomain: req.subdomain,
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found for this subdomain",
      });
    }

    res.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Get current organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get current organization",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations/logo
// @desc    Get organization logo by subdomain (Public - no auth required)
// @access  Public
router.get("/logo", async (req, res) => {
  try {
    const subdomain = req.subdomain || req.query.subdomain;

    if (!subdomain) {
      return res.status(400).json({
        success: false,
        message: "Subdomain is required",
      });
    }

    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne(
      { subdomain },
      { projection: { logo: 1, name: 1, displayName: 1, subdomain: 1 } }
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Return logo - if it's base64, return directly; otherwise build URL
    let logo = null;
    if (organization.logo) {
      if (organization.logo.startsWith("data:")) {
        // Base64 data URL - return directly
        logo = organization.logo;
      } else if (organization.logo.startsWith("/uploads/")) {
        // File path - build full URL
        logo = `${req.protocol}://${req.get("host")}${organization.logo}`;
      } else if (organization.logo.startsWith("http")) {
        // Already a full URL
        logo = organization.logo;
      } else {
        // Assume it's a filename in uploads/organizations/
        logo = `${req.protocol}://${req.get("host")}/uploads/organizations/${
          organization.logo
        }`;
      }
    }

    res.json({
      success: true,
      data: {
        logo: logo,
        name: organization.name,
        displayName: organization.displayName,
        subdomain: organization.subdomain,
      },
    });
  } catch (error) {
    console.error("Get organization logo error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get organization logo",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations/:subdomain/logo
// @desc    Get organization logo by subdomain parameter (Public - no auth required)
// @access  Public
router.get("/:subdomain/logo", async (req, res) => {
  try {
    const { subdomain } = req.params;
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne(
      { subdomain },
      { projection: { logo: 1, name: 1, displayName: 1, subdomain: 1 } }
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Return logo - if it's base64, return directly; otherwise build URL
    let logo = null;
    if (organization.logo) {
      if (organization.logo.startsWith("data:")) {
        // Base64 data URL - return directly
        logo = organization.logo;
      } else if (organization.logo.startsWith("/uploads/")) {
        // File path - build full URL
        logo = `${req.protocol}://${req.get("host")}${organization.logo}`;
      } else if (organization.logo.startsWith("http")) {
        // Already a full URL
        logo = organization.logo;
      } else {
        // Assume it's a filename in uploads/organizations/
        logo = `${req.protocol}://${req.get("host")}/uploads/organizations/${
          organization.logo
        }`;
      }
    }

    res.json({
      success: true,
      data: {
        logo: logo,
        name: organization.name,
        displayName: organization.displayName,
        subdomain: organization.subdomain,
      },
    });
  } catch (error) {
    console.error("Get organization logo error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get organization logo",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations
// @desc    Get all organizations (Admin only)
// @access  Private/Admin
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const organizationCollection = req.centralDb.collection("Organization");
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Filters
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.businessType) filter.businessType = req.query.businessType;
    if (req.query.isVerified !== undefined)
      filter.isVerified = req.query.isVerified === "true";
    if (req.query.subscriptionPlan)
      filter["subscription.plan"] = req.query.subscriptionPlan;

    const organizations = await organizationCollection
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .toArray();

    const total = await organizationCollection.countDocuments(filter);

    res.json({
      success: true,
      data: organizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get organizations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get organizations",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations/:subdomain
// @desc    Get organization by subdomain
// @access  Public (for current org) / Private/Admin (for any org)
router.get("/:subdomain", authenticate, async (req, res) => {
  try {
    const { subdomain } = req.params;
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne({ subdomain });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if user is admin or accessing their own org
    const isAdmin = req.user.role === "admin";
    const isOwnOrg = req.subdomain === subdomain;

    if (!isAdmin && !isOwnOrg) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Get organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get organization",
      error: error.message,
    });
  }
});



// @route   POST /api2/organizations
// @desc    Create new organization (Admin only)
// @access  Private/Admin
router.post("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      email,
      phone,
      registrationNumber,
      address,
      subdomain,
      businessType,
      industry,
      subscription,
      settings,
    } = req.body;

    const organizationCollection = req.centralDb.collection("Organization");

    // Check if subdomain already exists
    const existing = await organizationCollection.findOne({ subdomain });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Subdomain already exists",
      });
    }

    const organization = {
      name,
      displayName,
      description,
      email: Array.isArray(email) ? email : [email],
      phone: Array.isArray(phone) ? phone : [phone],
      registrationNumber,
      address,
      subdomain,
      businessType,
      industry,
      subscription: {
        plan: subscription?.plan || "free",
        status: subscription?.status || "active",
        autoRenew: subscription?.autoRenew !== false,
        startDate: new Date(),
      },
      settings: settings || {
        rentalSettings: {
          maxRentalDays: 30,
          lateFeePerDay: 0,
          gracePeriodDays: 3,
          autoReturn: false,
        },
        userSettings: {
          allowSelfRegistration: true,
          requireEmailVerification: true,
          maxUsers: 50,
        },
        notifications: {
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
        },
        maxStorage: 1024,
      },
      status: "active",
      isVerified: false,
      adminUsers: [],
      stats: {
        totalUsers: 0,
        totalRentals: 0,
        lastActivity: new Date(),
      },
      apiKeys: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await organizationCollection.insertOne(organization);

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: { _id: result.insertedId, ...organization },
    });
  } catch (error) {
    console.error("Create organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create organization",
      error: error.message,
    });
  }
});

// @route   PUT /api2/organizations/:subdomain
// @desc    Update organization
// @access  Private/Admin or Organization Admin
router.put("/:subdomain", authenticate, async (req, res) => {
  try {
    const { subdomain } = req.params;
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne({ subdomain });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const isOrgAdmin =
      organization.adminUsers &&
      organization.adminUsers.some(
        (adminId) => adminId.toString() === req.user.userId
      );

    if (!isAdmin && !isOrgAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const updateFields = {};
    const allowedFields = [
      "name",
      "displayName",
      "description",
      "email",
      "phone",
      "registrationNumber",
      "address",
      "businessType",
      "industry",
      "settings",
      "logo", // Allow logo to be updated (can be base64 or file path)
      "bankAccount",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    // Only admins can update subscription and status
    if (isAdmin) {
      if (req.body.subscription !== undefined)
        updateFields.subscription = req.body.subscription;
      if (req.body.status !== undefined) updateFields.status = req.body.status;
      if (req.body.isVerified !== undefined)
        updateFields.isVerified = req.body.isVerified;
    }

    updateFields.updatedAt = new Date();

    await organizationCollection.updateOne(
      { subdomain },
      { $set: updateFields }
    );

    const updated = await organizationCollection.findOne({ subdomain });

    res.json({
      success: true,
      message: "Organization updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update organization",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/organizations/:subdomain
// @desc    Delete organization (Admin only)
// @access  Private/Admin
router.delete(
  "/:subdomain",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { subdomain } = req.params;
      const organizationCollection = req.centralDb.collection("Organization");

      const organization = await organizationCollection.findOne({ subdomain });
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      await organizationCollection.deleteOne({ subdomain });

      res.json({
        success: true,
        message: "Organization deleted successfully",
      });
    } catch (error) {
      console.error("Delete organization error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete organization",
        error: error.message,
      });
    }
  }
);

// @route   GET /api2/organizations/:subdomain/stats
// @desc    Get organization statistics
// @access  Private
router.get("/:subdomain/stats", authenticate, async (req, res) => {
  try {
    const { subdomain } = req.params;
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne(
      { subdomain },
      { projection: { stats: 1, subdomain: 1, name: 1 } }
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Get real-time stats from org database
    const userCollection =
      req.db.collection("users") || req.db.collection("User");
    const comicCollection = req.db.collection("Comic");
    const chapterCollection = req.db.collection("Chapter");

    const [totalUsers, totalComics, totalChapters] = await Promise.all([
      userCollection.countDocuments(),
      comicCollection.countDocuments(),
      chapterCollection.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        ...organization.stats,
        totalUsers,
        totalComics,
        totalChapters,
        subdomain: organization.subdomain,
        name: organization.name,
      },
    });
  } catch (error) {
    console.error("Get organization stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get organization stats",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations/license
// @desc    Get current organization license info
// @access  Public (or Private if you want to restrict)
router.get("/license", async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne(
      { subdomain },
      { projection: { subscription: 1, name: 1, displayName: 1 } }
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Calculate endDate if not present (default to 30 days from startDate)
    let subscription = { ...organization.subscription };
    if (!subscription.endDate && subscription.startDate) {
      const startDate = new Date(subscription.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 30);
      subscription.endDate = endDate;
    }

    console.log('License Request - Subdomain:', subdomain);
    console.log('License Request - Organization found:', organization ? 'Yes' : 'No');
    if (organization) {
      console.log('License Request - Subscription:', organization.subscription);
    }

    res.json({
      success: true,
      data: {
        subscription: subscription,
        name: organization.name,
        displayName: organization.displayName,
      },
    });
  } catch (error) {
    console.error("Get license info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get license info",
      error: error.message,
    });
  }
});

// @route   GET /api2/organizations/current
// @desc    Get current organization (based on subdomain)
// @access  Private
router.get("/current", authenticate, async (req, res) => {
  try {
    const organizationCollection = req.centralDb.collection("Organization");

    const organization = await organizationCollection.findOne({
      subdomain: req.subdomain,
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found for this subdomain",
      });
    }

    res.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Get current organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get current organization",
      error: error.message,
    });
  }
});

module.exports = router;
