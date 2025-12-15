const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if subdomain matches - if not, verify user exists in requested subdomain
    if (decoded.subdomain !== req.subdomain) {
      console.log(
        `🔄 Token subdomain (${decoded.subdomain}) doesn't match request subdomain (${req.subdomain}). Checking if user exists in requested subdomain...`
      );

      // Use the existing database connection for the requested subdomain (already set by database middleware)
      if (!req.db) {
        console.error(
          "❌ Database connection not available for subdomain check"
        );
        return res.status(500).json({
          success: false,
          message: "Database connection error",
        });
      }

      try {
        // Check if user exists in requested subdomain's database
        const usersCollection = req.db.collection("users");
        const UserCollection = req.db.collection("User");

        // Try to find user by email (case-insensitive)
        const emailRegex = new RegExp(
          `^${decoded.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        );
        let user = await usersCollection.findOne({ email: emailRegex });

        if (!user) {
          user = await UserCollection.findOne({ email: emailRegex });
        }

        if (!user) {
          console.log(
            `❌ User ${decoded.email} not found in subdomain ${req.subdomain}`
          );
          return res.status(403).json({
            success: false,
            message: "Token is not valid for this subdomain",
          });
        }

        console.log(
          `✅ User ${decoded.email} found in subdomain ${req.subdomain}. Allowing token sharing.`
        );

        // User exists in requested subdomain - allow token sharing
        // Update req.user with requested subdomain and user's actual ID in this subdomain
        req.user = {
          userId: user._id.toString(), // Use the user's ID from the requested subdomain
          email: decoded.email,
          subdomain: req.subdomain, // Use requested subdomain, not token's subdomain
          role: user.role || decoded.role, // Use role from requested subdomain if available
        };

        next();
        return;
      } catch (dbError) {
        console.error("Error checking user in requested subdomain:", dbError);
        return res.status(403).json({
          success: false,
          message: "Token is not valid for this subdomain",
        });
      }
    }

    // Subdomain matches - proceed normally
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      subdomain: decoded.subdomain,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

// Middleware to check user role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
        userRole: req.user.role,
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
