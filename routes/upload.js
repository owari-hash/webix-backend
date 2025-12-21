const express = require("express");
const path = require("path");
const fs = require("fs");
const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api2/upload/cover
// @desc    Upload comic cover image
// @access  Private
router.post("/cover", authenticate, upload.single("cover"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Return the file path with subdomain organization
    const subdomain = req.subdomain || "default";
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${subdomain}/${
      req.file.filename
    }`;

    res.json({
      success: true,
      message: "Cover image uploaded successfully",
      file: {
        filename: req.file.filename,
        path: `/uploads/${subdomain}/${req.file.filename}`,
        url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error("Upload cover error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload cover image",
      error: error.message,
    });
  }
});

// @route   POST /api2/upload/pages
// @desc    Upload multiple chapter page images
// @access  Private
router.post("/pages", authenticate, upload.array("pages", 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // Map uploaded files to return their info
    const subdomain = req.subdomain || "default";
    const files = req.files.map((file) => ({
      filename: file.filename,
      path: `/uploads/${subdomain}/${file.filename}`,
      url: `${req.protocol}://${req.get("host")}/uploads/${subdomain}/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    }));

    res.json({
      success: true,
      message: `${files.length} page image(s) uploaded successfully`,
      count: files.length,
      files: files,
    });
  } catch (error) {
    console.error("Upload pages error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload page images",
      error: error.message,
    });
  }
});

// @route   POST /api2/upload/single
// @desc    Upload single image (general purpose)
// @access  Private
router.post("/single", authenticate, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const subdomain = req.subdomain || "default";
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${subdomain}/${
      req.file.filename
    }`;

    res.json({
      success: true,
      message: "Image uploaded successfully",
      file: {
        filename: req.file.filename,
        path: `/uploads/${subdomain}/${req.file.filename}`,
        url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error("Upload single error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
});

// @route   POST /api2/upload/base64
// @desc    Upload image from base64 string
// @access  Private
router.post("/base64", authenticate, async (req, res) => {
  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Image data is required",
      });
    }

    // Extract base64 data
    let base64Data = image;
    let mimeType = "image/jpeg";
    let ext = ".jpg";

    // Handle data URI format: data:image/png;base64,...
    if (image.startsWith("data:")) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({
          success: false,
          message: "Invalid base64 image format",
        });
      }
      mimeType = matches[1];
      base64Data = matches[2];
      
      // Determine extension from mime type
      if (mimeType.includes("png")) ext = ".png";
      else if (mimeType.includes("gif")) ext = ".gif";
      else if (mimeType.includes("webp")) ext = ".webp";
      else ext = ".jpg";
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Validate file size (10MB max)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Image size exceeds 10MB limit",
      });
    }

    // Organize by subdomain
    const subdomain = req.subdomain || "default";
    const uploadDir = path.join("uploads", subdomain);
    
    // Create subdomain directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const finalFilename = filename 
      ? `${uniqueSuffix}-${filename}${ext}`
      : `${uniqueSuffix}${ext}`;
    
    const filePath = path.join(uploadDir, finalFilename);

    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Return file info
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${subdomain}/${finalFilename}`;

    res.json({
      success: true,
      message: "Image uploaded successfully",
      file: {
        filename: finalFilename,
        path: `/uploads/${subdomain}/${finalFilename}`,
        url: fileUrl,
        size: buffer.length,
        mimetype: mimeType,
      },
    });
  } catch (error) {
    console.error("Upload base64 error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
});

module.exports = router;
