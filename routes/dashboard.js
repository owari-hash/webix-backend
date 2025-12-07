const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

/**
 * @route   GET /api2/dashboard
 * @desc    Get CMS dashboard statistics
 * @access  Private (Admin only)
 */
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const tenantDb = req.db;
    const centralDb = req.centralDb;
    const mongoose = require("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    // Get organization license info
    const organizationCollection = centralDb.collection("Organization");
    const organization = await organizationCollection.findOne(
      { subdomain },
      { projection: { subscription: 1, name: 1, displayName: 1 } }
    );

    let licenseExpiry = null;
    if (organization?.subscription?.endDate) {
      licenseExpiry = new Date(organization.subscription.endDate);
    } else if (organization?.subscription?.startDate) {
      // Default to 30 days from start if no end date
      const startDate = new Date(organization.subscription.startDate);
      licenseExpiry = new Date(startDate);
      licenseExpiry.setDate(startDate.getDate() + 30);
    }

    // Get collections
    const comicsCollection = tenantDb.db.collection("Comic");
    const chaptersCollection = tenantDb.db.collection("Chapter");
    const likesCollection = tenantDb.db.collection("Like");
    const feedbackCollection = tenantDb.db.collection("Feedback");

    // Run all queries in parallel for better performance
    const [
      totalComics,
      totalChapters,
      ongoingComics,
      completedComics,
      totalLikes,
      totalFeedback,
      comicsViewsResult,
      chaptersViewsResult,
      latestComics,
    ] = await Promise.all([
      // Total comics
      comicsCollection.countDocuments({ subdomain }),

      // Total chapters
      chaptersCollection.countDocuments({ subdomain }),

      // Ongoing comics
      comicsCollection.countDocuments({
        subdomain,
        status: "ongoing",
      }),

      // Completed comics
      comicsCollection.countDocuments({
        subdomain,
        status: "completed",
      }),

      // Total likes (only "like" type, not "dislike")
      likesCollection.countDocuments({
        subdomain,
        type: "like",
      }),

      // Total feedback (not deleted)
      feedbackCollection.countDocuments({
        subdomain,
        is_deleted: false,
      }),

      // Total views from comics
      comicsCollection.aggregate([
        { $match: { subdomain } },
        { $group: { _id: null, total: { $sum: "$views" } } },
      ]).toArray(),

      // Total views from chapters
      chaptersCollection.aggregate([
        { $match: { subdomain } },
        { $group: { _id: null, total: { $sum: "$views" } } },
      ]).toArray(),

      // Latest comics (limit 10)
      comicsCollection
        .find({ subdomain })
        .sort({ createdAt: -1 })
        .limit(10)
        .project({
          _id: 1,
          title: 1,
          coverImage: 1,
          status: 1,
          views: 1,
          likes: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .toArray(),
    ]);

    // Calculate total views
    const comicsViews = comicsViewsResult[0]?.total || 0;
    const chaptersViews = chaptersViewsResult[0]?.total || 0;
    const totalViews = comicsViews + chaptersViews;

    // Format latest comics
    const formattedLatestComics = latestComics.map((comic) => ({
      id: comic._id,
      title: comic.title,
      coverImage: comic.coverImage,
      status: comic.status,
      views: comic.views || 0,
      likes: comic.likes || 0,
      createdAt: comic.createdAt,
      updatedAt: comic.updatedAt,
    }));

    res.json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: {
        license: {
          expiry: licenseExpiry ? licenseExpiry.toISOString() : null,
          expiryDate: licenseExpiry
            ? licenseExpiry.toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
            : null,
          formatted: licenseExpiry
            ? `${licenseExpiry.getMonth() + 1}/${licenseExpiry.getDate()}/${licenseExpiry.getFullYear()}`
            : null,
        },
        statistics: {
          total_comics: totalComics,
          total_chapters: totalChapters,
          total_views: totalViews,
          total_likes: totalLikes,
          ongoing_comics: ongoingComics,
          completed_comics: completedComics,
          total_feedback: totalFeedback,
        },
        latest_comics: formattedLatestComics,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get dashboard statistics",
    });
  }
});

module.exports = router;

