const express = require("express");
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

    // Return the file path
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: "Cover image uploaded successfully",
      file: {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
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
    const files = req.files.map((file) => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
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

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: "Image uploaded successfully",
      file: {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
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

module.exports = router;

