const express = require("express");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

// @route   GET /api2/notifications
// @desc    Get user notifications
// @access  Private
router.get("/", authenticate, async (req, res) => {
  try {
    const notifications = [];
    
    // 1. Check for License Expiration (Admin only)
    if (req.user.role === "admin") {
      const subdomain = req.subdomain;
      const organizationCollection = req.centralDb.collection("Organization");
      
      const organization = await organizationCollection.findOne(
        { subdomain },
        { projection: { subscription: 1 } }
      );

      if (organization && organization.subscription) {
        const { endDate, status } = organization.subscription;
        
        if (endDate) {
          const end = new Date(endDate);
          const now = new Date();
          const diffTime = end.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          console.log('Notification Check:', {
            role: req.user.role,
            endDate: endDate,
            endISO: end.toISOString(),
            nowISO: now.toISOString(),
            diffTime,
            diffDays
          });

          // Alert if expiring within 7 days or already expired
          if (diffDays <= 7) {
            notifications.push({
              id: "license-expiry",
              type: diffDays < 0 ? "error" : "warning",
              title: diffDays < 0 ? "Лиценз дууссан байна!" : "Лиценз дуусахад дөхөж байна",
              message: diffDays < 0 
                ? "Таны лицензийн хугацаа дууссан байна. Сунгалт хийнэ үү." 
                : `Таны лиценз ${diffDays} хоногийн дараа дуусна.`,
              createdAt: new Date(),
              isUnread: true,
              action: "/cms/settings/billing" // Example action link
            });
          }
        }
      }
    }

    // 2. Add other notification logic here (e.g. new comments, system alerts)

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: error.message,
    });
  }
});

module.exports = router;
