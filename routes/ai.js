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
 * Preferred provider:
 * - Gemini / Imagen: set GEMINI_API_KEY
 *
 * Optional:
 * - GEMINI_IMAGE_MODEL (default: "imagen-3.0-generate-002")
 * - GEMINI_IMAGE_SIZE (default: "1K")
 * - GEMINI_IMAGE_ASPECT_RATIO (default: "3:4")
 *
 * Fallback provider (optional):
 * - OpenAI: set OPENAI_API_KEY
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

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return res.status(501).json({
        success: false,
        message: "AI image generation is not configured",
        error:
          "Missing GEMINI_API_KEY (preferred) or OPENAI_API_KEY (fallback)",
      });
    }

    if (typeof fetch !== "function") {
      return res.status(500).json({
        success: false,
        message: "Server does not support fetch()",
      });
    }

    // Help the model create a clean cover (no readable text).
    const finalPrompt = [
      trimmedPrompt,
      "Book cover illustration, modern, cinematic lighting, high quality, clean composition.",
      "No readable text, no letters, no watermark, no logo.",
      "Vertical cover, centered subject, strong mood.",
    ].join("\n");

    // Prefer Gemini/Imagen if GEMINI_API_KEY is present
    if (geminiKey) {
      const { GoogleGenAI } = require("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const model = process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002";
      const imageSize = process.env.GEMINI_IMAGE_SIZE || "1K";
      const aspectRatio = process.env.GEMINI_IMAGE_ASPECT_RATIO || "3:4";

      const response = await ai.models.generateImages({
        model,
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          imageSize,
          aspectRatio,
        },
      });

      const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
      const mimeType =
        response?.generatedImages?.[0]?.image?.mimeType || "image/png";

      if (!imageBytes) {
        return res.status(500).json({
          success: false,
          message: "Gemini returned no image data",
        });
      }

      const buffer = Buffer.from(imageBytes, "base64");
      const uploadsDir = ensureUploadsDir();
      const ext =
        mimeType === "image/jpeg"
          ? "jpg"
          : mimeType === "image/webp"
          ? "webp"
          : "png";
      const filename = `ai-cover-${Date.now()}-${crypto
        .randomBytes(6)
        .toString("hex")}.${ext}`;
      const filepath = path.join(uploadsDir, filename);

      fs.writeFileSync(filepath, buffer);

      const fileUrl = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${filename}`;

      return res.json({
        success: true,
        message: "Cover image generated",
        provider: "gemini",
        file: {
          filename,
          path: `/uploads/${filename}`,
          url: fileUrl,
          size: buffer.length,
          mimetype: mimeType,
        },
      });
    }

    // Fallback: OpenAI (if configured)
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,
        size,
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

    return res.json({
      success: true,
      message: "Cover image generated",
      provider: "openai",
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
