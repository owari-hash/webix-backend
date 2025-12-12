const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function ensureUploadsDir() {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * POST /api2/ai/cover
 * Generate a cover image from a prompt (e.g. novel description).
 *
 * Requires:
 * - OPENAI_API_KEY env var
 *
 * Optional:
 * - OPENAI_IMAGE_MODEL (default: "gpt-image-1")
 */
router.post("/cover", authenticate, async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    const size = req.body?.size || "1024x1024";

    if (!isNonEmptyString(prompt)) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Prompt is too short",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(501).json({
        success: false,
        message: "AI image generation is not configured",
        error: "Missing OPENAI_API_KEY",
      });
    }

    if (typeof fetch !== "function") {
      return res.status(500).json({
        success: false,
        message: "Server does not support fetch()",
      });
    }

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    // Help the model create a clean cover (no readable text).
    const finalPrompt = [
      trimmedPrompt,
      "Book cover illustration, modern, cinematic lighting, high quality, clean composition.",
      "No readable text, no letters, no watermark, no logo.",
      "Vertical cover, centered subject, strong mood.",
    ].join("\n");

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,
        size,
        // We store as an uploaded file and return URL
        response_format: "b64_json",
      }),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      return res.status(500).json({
        success: false,
        message: "AI image generation failed",
        error: data?.error?.message || `HTTP ${resp.status}`,
      });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({
        success: false,
        message: "AI returned no image data",
      });
    }

    const buffer = Buffer.from(b64, "base64");
    const uploadsDir = ensureUploadsDir();
    const filename = `ai-cover-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.png`;
    const filepath = path.join(uploadsDir, filename);

    fs.writeFileSync(filepath, buffer);

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;

    res.json({
      success: true,
      message: "Cover image generated",
      file: {
        filename,
        path: `/uploads/${filename}`,
        url: fileUrl,
        size: buffer.length,
        mimetype: "image/png",
      },
    });
  } catch (error) {
    console.error("AI cover generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI cover image",
      error: error.message,
    });
  }
});

module.exports = router;
