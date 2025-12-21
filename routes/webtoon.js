const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Helper function to validate ObjectId
function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Reserved words that should not be treated as IDs
const RESERVED_WORDS = [
  "novels",
  "comics",
  "chapters",
  "trending",
  "new",
  "completed",
  "search",
  "browse",
  "categories",
];

// @route   POST /api2/webtoon/comic
// @desc    Create a new comic
// @access  Private
const { notifyAdmins } = require("../utils/notifications");

router.post("/comic", authenticate, async (req, res) => {
  try {
    const { title, description, coverImage, genre, status } = req.body;

    if (!title || !description || !coverImage) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and cover image are required",
      });
    }

    const collection = req.db.collection("Comic");

    const comic = {
      title,
      description,
      coverImage,
      genre: genre || [],
      author: req.user.userId,
      status: status || "ongoing",
      views: 0,
      likes: 0,
      subdomain: req.subdomain,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(comic);

    // Notify admins that a new comic was created
    try {
      await notifyAdmins({
        tenantDb: req.db,
        subdomain: req.subdomain,
        type: "content_new_comic",
        title: "Шинэ манхва нэмэгдлээ",
        message: comic.title,
        metadata: {
          comicId: result.insertedId,
        },
      });
    } catch (notifError) {
      console.error("New comic notification error:", notifError);
      // Do not fail the main request on notification error
    }

    res.status(201).json({
      success: true,
      message: "Comic created successfully",
      comic: {
        id: result.insertedId,
        ...comic,
      },
    });
  } catch (error) {
    console.error("Create comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create comic",
      error: error.message,
    });
  }
});

// @route   GET /api2/webtoon/comics
// @desc    Get all comics with pagination
// @access  Public
router.get("/comics", async (req, res) => {
  try {
    const collection = req.db.collection("Comic");

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Get total count
    const total = await collection.countDocuments({});

    // Get paginated comics
    const comics = await collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      success: true,
      count: comics.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comics,
    });
  } catch (error) {
    console.error("Get comics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comics",
      error: error.message,
    });
  }
});

// @route   PUT /api2/webtoon/comic/:id
// @desc    Update comic
// @access  Private
router.put("/comic/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { title, description, coverImage, genre, status } = req.body;
    const collection = req.db.collection("Comic");

    const updateFields = { updatedAt: new Date() };
    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (coverImage) updateFields.coverImage = coverImage;
    if (genre) updateFields.genre = genre;
    if (status) updateFields.status = status;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id), author: req.user.userId },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Comic not found or unauthorized",
      });
    }

    res.json({
      success: true,
      message: "Comic updated successfully",
      comic: result,
    });
  } catch (error) {
    console.error("Update comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comic",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/webtoon/comic/:id
// @desc    Delete comic
// @access  Private
router.delete("/comic/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const collection = req.db.collection("Comic");

    const result = await collection.deleteOne({
      _id: new ObjectId(req.params.id),
      author: req.user.userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Comic not found or unauthorized",
      });
    }

    // Also delete all chapters of this comic
    const chapterCollection = req.db.collection("Chapter");
    const chapters = await chapterCollection
      .find({ comicId: new ObjectId(req.params.id) })
      .toArray();
    const chapterIds = chapters.map((ch) => ch._id);

    await chapterCollection.deleteMany({
      comicId: new ObjectId(req.params.id),
    });

    // Delete all comments on this comic and its chapters
    const commentCollection = req.db.collection("Comment");
    await commentCollection.deleteMany({
      $or: [
        { comicId: new ObjectId(req.params.id) },
        { chapterId: { $in: chapterIds } },
      ],
    });

    res.json({
      success: true,
      message: "Comic, chapters, and comments deleted successfully",
    });
  } catch (error) {
    console.error("Delete comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comic",
      error: error.message,
    });
  }
});

// @route   POST /api2/webtoon/comic/:comicId/chapter
// @desc    Add chapter to comic
// @access  Private
router.post("/comic/:comicId/chapter", authenticate, async (req, res) => {
  try {
    console.log(
      `📥 [Chapter Create] POST /api2/webtoon/comic/${req.params.comicId}/chapter`
    );
    console.log(`📥 [Chapter Create] Subdomain: ${req.subdomain}`);
    console.log(
      `📥 [Chapter Create] Request body keys:`,
      Object.keys(req.body)
    );

    const { ObjectId } = require("mongodb");
    const { chapterNumber, title, images } = req.body;
    const { comicId } = req.params;

    console.log(
      `📥 [Chapter Create] Chapter number: ${chapterNumber}, Title: ${title}, Images count: ${
        images?.length || 0
      }`
    );

    if (!chapterNumber || !title || !images || !Array.isArray(images)) {
      console.error(
        `❌ [Chapter Create] Validation failed: chapterNumber=${!!chapterNumber}, title=${!!title}, images=${!!images}, isArray=${Array.isArray(
          images
        )}`
      );
      return res.status(400).json({
        success: false,
        message: "Chapter number, title, and images array are required",
      });
    }

    if (images.length === 0) {
      console.error(`❌ [Chapter Create] No images provided`);
      return res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
    }

    // Calculate payload size
    const payloadSize = JSON.stringify(req.body).length;
    const payloadMB = (payloadSize / (1024 * 1024)).toFixed(2);
    console.log(
      `📥 [Chapter Create] Payload size: ~${payloadMB}MB, Images: ${images.length}`
    );

    // Check if images are base64
    const base64Count = images.filter(
      (img) =>
        typeof img === "string" &&
        (img.startsWith("data:image") || img.length > 1000)
    ).length;
    if (base64Count > 0) {
      console.log(
        `⚠️ [Chapter Create] Warning: ${base64Count} base64 images detected (should be converted to file URLs)`
      );
    }

    // Check if comic exists
    const comicCollection = req.db.collection("Comic");
    const comic = await comicCollection.findOne({
      _id: new ObjectId(comicId),
    });

    if (!comic) {
      return res.status(404).json({
        success: false,
        message: "Comic not found",
      });
    }

    const chapterCollection = req.db.collection("Chapter");

    // Check if chapter number already exists
    const existingChapter = await chapterCollection.findOne({
      comicId: new ObjectId(comicId),
      chapterNumber,
    });

    if (existingChapter) {
      return res.status(400).json({
        success: false,
        message: "Chapter number already exists for this comic",
      });
    }

    const chapter = {
      comicId: new ObjectId(comicId),
      chapterNumber,
      title,
      images,
      views: 0,
      likes: 0,
      subdomain: req.subdomain,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(`💾 [Chapter Create] Inserting chapter into database...`);
    const result = await chapterCollection.insertOne(chapter);
    console.log(
      `✅ [Chapter Create] Chapter created successfully with ID: ${result.insertedId}`
    );

    res.status(201).json({
      success: true,
      message: "Chapter added successfully",
      chapter: {
        id: result.insertedId,
        ...chapter,
      },
    });
  } catch (error) {
    console.error("❌ [Chapter Create] Add chapter error:", error);
    console.error("❌ [Chapter Create] Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to add chapter",
      error: error.message,
    });
  }
});

// @route   GET /api2/webtoon/comic/:id
// @desc    Get single comic
// @access  Public
// NOTE: This route must come AFTER /comic/:comicId/chapters to avoid route conflicts
router.get("/comic/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");

    // Reject reserved words
    if (RESERVED_WORDS.includes(req.params.id.toLowerCase())) {
      return res.status(404).json({
        success: false,
        message: "Not found",
        error: `"${req.params.id}" is a reserved word and cannot be used as an ID`,
      });
    }

    // Validate ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comic ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("Comic");

    const comic = await collection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!comic) {
      return res.status(404).json({
        success: false,
        message: "Comic not found",
      });
    }

    res.json({
      success: true,
      comic,
    });
  } catch (error) {
    console.error("Get comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comic",
      error: error.message,
    });
  }
});

// @route   GET /api2/webtoon/comic/:comicId/chapter
// @desc    Get latest chapter of a comic (alias for convenience)
// @access  Public
router.get("/comic/:comicId/chapter", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");

    // Validate ObjectId
    if (!isValidObjectId(req.params.comicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comic ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("Chapter");

    // Get the latest chapter (highest chapter number)
    const latestChapter = await collection.findOne(
      { comicId: new ObjectId(req.params.comicId) },
      { sort: { chapterNumber: -1 } }
    );

    if (!latestChapter) {
      return res.status(404).json({
        success: false,
        message: "No chapters found for this comic",
      });
    }

    // Keep base64 images as-is (no conversion to URLs)
    // DISABLED: Base64 images are stored directly in database
    // if (latestChapter.images && Array.isArray(latestChapter.images)) {
    //   latestChapter.images = await convertBase64ImagesToUrls(
    //     req,
    //     latestChapter.images
    //   );
    //   await collection.updateOne(
    //     { _id: latestChapter._id },
    //     { $set: { images: latestChapter.images } }
    //   );
    // }

    res.json({
      success: true,
      chapter: latestChapter,
    });
  } catch (error) {
    console.error("Get latest chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get latest chapter",
      error: error.message,
    });
  }
});

// @route   GET /api2/webtoon/comic/:comicId/chapters
// @desc    Get all chapters of a comic
// @access  Public
router.get("/comic/:comicId/chapters", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");

    // Validate ObjectId
    if (!isValidObjectId(req.params.comicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comic ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("Chapter");

    const chapters = await collection
      .find({ comicId: new ObjectId(req.params.comicId) })
      .sort({ chapterNumber: 1 })
      .toArray();

    // Convert base64 images to file URLs for all chapters
    // Keep base64 images as-is (no conversion to URLs)
    // DISABLED: Base64 images are stored directly in database
    const chaptersWithUrls = chapters.map((chapter) => {
      // No conversion - return images as-is
      return chapter;
    });

    res.json({
      success: true,
      count: chaptersWithUrls.length,
      chapters: chaptersWithUrls,
    });
  } catch (error) {
    console.error("Get chapters error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get chapters",
      error: error.message,
    });
  }
});

// Helper function to convert base64 images to file URLs
async function convertBase64ImagesToUrls(req, images) {
  if (!Array.isArray(images)) return images;

  const fs = require("fs");
  const path = require("path");
  const { ObjectId } = require("mongodb");

  const convertedImages = await Promise.all(
    images.map(async (image) => {
      // If already a URL, return as is
      if (
        typeof image === "string" &&
        (image.startsWith("http") || image.startsWith("/uploads"))
      ) {
        return image;
      }

      // If it's a base64 image, convert it
      if (
        typeof image === "string" &&
        (image.startsWith("data:image") || image.length > 1000)
      ) {
        try {
          // Extract base64 data
          let base64Data = image;
          let mimeType = "image/jpeg";
          let ext = ".jpg";

          if (image.startsWith("data:")) {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];

              if (mimeType.includes("png")) ext = ".png";
              else if (mimeType.includes("gif")) ext = ".gif";
              else if (mimeType.includes("webp")) ext = ".webp";
            }
          }

          // Convert base64 to buffer
          const buffer = Buffer.from(base64Data, "base64");

          // Organize by subdomain
          const subdomain = req.subdomain || "default";
          const uploadDir = path.join("uploads", subdomain);

          // Create subdomain directory if it doesn't exist
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Generate unique filename
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const finalFilename = `${uniqueSuffix}${ext}`;

          const filePath = path.join(uploadDir, finalFilename);

          // Write file to disk
          fs.writeFileSync(filePath, buffer);

          // Return file URL
          const fileUrl = `${req.protocol}://${req.get(
            "host"
          )}/uploads/${subdomain}/${finalFilename}`;

          return fileUrl;
        } catch (error) {
          console.error("Error converting base64 image:", error);
          return image; // Return original if conversion fails
        }
      }

      return image;
    })
  );

  return convertedImages;
}

// @route   GET /api2/webtoon/chapter/:id
// @desc    Get single chapter
// @access  Public
router.get("/chapter/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");

    // Validate ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chapter ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("Chapter");

    const chapter = await collection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    // Keep base64 images as-is (no conversion to URLs)
    // Base64 images are stored directly in database
    // if (chapter.images && Array.isArray(chapter.images)) {
    //   chapter.images = await convertBase64ImagesToUrls(req, chapter.images);
    //   // DISABLED: No longer converting base64 to URLs - storing base64 directly
    // }

    // Increment view count
    await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { views: 1 } }
    );

    res.json({
      success: true,
      chapter,
    });
  } catch (error) {
    console.error("Get chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get chapter",
      error: error.message,
    });
  }
});

// @route   PUT /api2/webtoon/chapter/:id
// @desc    Update chapter
// @access  Private
router.put("/chapter/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { title, images } = req.body;
    const collection = req.db.collection("Chapter");

    const updateFields = { updatedAt: new Date() };
    if (title) updateFields.title = title;
    if (images && Array.isArray(images)) updateFields.images = images;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    res.json({
      success: true,
      message: "Chapter updated successfully",
      chapter: result,
    });
  } catch (error) {
    console.error("Update chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update chapter",
      error: error.message,
    });
  }
});

// @route   PATCH /api2/webtoon/chapter/:id
// @desc    Append images to existing chapter
// @access  Private
router.patch("/chapter/:id", authenticate, async (req, res) => {
  try {
    console.log(
      `📥 [Chapter Update] PATCH /api2/webtoon/chapter/${req.params.id}`
    );
    console.log(`📥 [Chapter Update] Subdomain: ${req.subdomain}`);
    console.log(
      `📥 [Chapter Update] Request body keys:`,
      Object.keys(req.body)
    );

    const { ObjectId } = require("mongodb");
    const { images, append } = req.body;

    if (images) {
      const payloadSize = JSON.stringify(req.body).length;
      const payloadMB = (payloadSize / (1024 * 1024)).toFixed(2);
      console.log(
        `📥 [Chapter Update] Images count: ${
          Array.isArray(images) ? images.length : "N/A"
        }, Payload size: ~${payloadMB}MB, Append: ${append}`
      );

      if (Array.isArray(images)) {
        const base64Count = images.filter(
          (img) =>
            typeof img === "string" &&
            (img.startsWith("data:image") || img.length > 1000)
        ).length;
        if (base64Count > 0) {
          console.log(
            `⚠️ [Chapter Update] Warning: ${base64Count} base64 images detected (should be converted to file URLs)`
          );
        }
      }
    }

    const collection = req.db.collection("Chapter");

    // Find the chapter first
    const chapter = await collection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    let updateOperation;
    if (append && Array.isArray(images)) {
      // APPEND: Add new images to existing ones
      updateOperation = {
        $push: { images: { $each: images } },
        $set: { updatedAt: new Date() },
      };
    } else if (Array.isArray(images)) {
      // REPLACE: Replace all images
      updateOperation = {
        $set: {
          images: images,
          updatedAt: new Date(),
        },
      };
    } else {
      return res.status(400).json({
        success: false,
        message: "Images array is required",
      });
    }

    console.log(
      `💾 [Chapter Update] Updating chapter with operation:`,
      append ? "APPEND" : "REPLACE"
    );
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      updateOperation,
      { returnDocument: "after" }
    );

    console.log(
      `✅ [Chapter Update] Chapter updated successfully. Total images: ${
        result.value?.images?.length || 0
      }`
    );

    res.json({
      success: true,
      message: append
        ? `${images.length} images appended successfully`
        : "Images updated successfully",
      chapter: result.value,
      totalImages: result.value?.images?.length || 0,
    });
  } catch (error) {
    console.error("❌ [Chapter Update] Append images error:", error);
    console.error("❌ [Chapter Update] Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to append images",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/webtoon/chapter/:id
// @desc    Delete chapter
// @access  Private
router.delete("/chapter/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const collection = req.db.collection("Chapter");

    const result = await collection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    // Delete all comments on this chapter
    const commentCollection = req.db.collection("Comment");
    await commentCollection.deleteMany({
      chapterId: new ObjectId(req.params.id),
    });

    res.json({
      success: true,
      message: "Chapter and its comments deleted successfully",
    });
  } catch (error) {
    console.error("Delete chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete chapter",
      error: error.message,
    });
  }
});

// NOTE: Novel routes have been moved to /api2/novel - see routes/novel.js

// ============================================================================
// FAVORITES ENDPOINTS
// ============================================================================

const { ObjectId } = require("mongodb");

// @route   GET /api2/webtoon/user/favorites
// @desc    Get user's favorites
// @access  Private
router.get("/user/favorites", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get favorites using native MongoDB collection
    const favoritesCollection = req.db.collection("Favorite");
    const favorites = await favoritesCollection
      .find({
        user: new ObjectId(userId),
        subdomain: subdomain,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Populate comic and novel data
    const comicCollection = req.db.collection("Comic");
    const novelCollection = req.db.collection("Novel");

    const populatedFavorites = await Promise.all(
      favorites.map(async (favorite) => {
        if (favorite.comicId) {
          const comic = await comicCollection.findOne({
            _id: favorite.comicId,
            subdomain: subdomain,
          });
          return {
            ...favorite,
            type: "comic",
            comic: comic || null,
          };
        } else if (favorite.novelId) {
          const novel = await novelCollection.findOne({
            _id: favorite.novelId,
            subdomain: subdomain,
          });
          return {
            ...favorite,
            type: "novel",
            novel: novel || null,
          };
        }
        return favorite;
      })
    );

    // Filter out favorites where the comic/novel doesn't exist
    const validFavorites = populatedFavorites.filter(
      (fav) =>
        (fav.type === "comic" && fav.comic) ||
        (fav.type === "novel" && fav.novel)
    );

    const total = await favoritesCollection.countDocuments({
      user: new ObjectId(userId),
      subdomain: subdomain,
    });

    res.json({
      success: true,
      favorites: validFavorites,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get favorites",
      error: error.message,
    });
  }
});

// @route   POST /api2/webtoon/user/favorites
// @desc    Add a favorite
// @access  Private
router.post("/user/favorites", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const { comicId, novelId } = req.body;

    if (!comicId && !novelId) {
      return res.status(400).json({
        success: false,
        message: "Either comicId or novelId is required",
      });
    }

    // Check if already favorited using native MongoDB collection
    const favoritesCollection = req.db.collection("Favorite");
    const existing = await favoritesCollection.findOne({
      user: new ObjectId(userId),
      subdomain: subdomain,
      ...(comicId
        ? { comicId: new ObjectId(comicId) }
        : { novelId: new ObjectId(novelId) }),
    });

    if (existing) {
      return res.json({
        success: true,
        message: "Already in favorites",
        favorite: existing,
      });
    }

    // Create favorite
    const favorite = {
      user: new ObjectId(userId),
      subdomain: subdomain,
      ...(comicId
        ? { comicId: new ObjectId(comicId) }
        : { novelId: new ObjectId(novelId) }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await favoritesCollection.insertOne(favorite);
    const insertedFavorite = await favoritesCollection.findOne({
      _id: result.insertedId,
    });

    res.status(201).json({
      success: true,
      message: "Added to favorites",
      favorite: insertedFavorite,
    });
  } catch (error) {
    console.error("Add favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add favorite",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/webtoon/user/favorites/:id
// @desc    Remove a favorite
// @access  Private
router.delete("/user/favorites/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const favoriteId = req.params.id;

    const favoritesCollection = req.db.collection("Favorite");
    const favorite = await favoritesCollection.findOneAndDelete({
      _id: new ObjectId(favoriteId),
      user: new ObjectId(userId),
      subdomain: subdomain,
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: "Favorite not found",
      });
    }

    res.json({
      success: true,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Remove favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove favorite",
      error: error.message,
    });
  }
});

// ============================================================================
// READING HISTORY ENDPOINTS
// ============================================================================

// @route   GET /api2/webtoon/user/history
// @desc    Get user's reading history
// @access  Private
router.get("/user/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get reading history using native MongoDB collection
    const readingHistoryCollection = req.db.collection("ReadingHistory");
    const history = await readingHistoryCollection
      .find({
        user: new ObjectId(userId),
        subdomain: subdomain,
      })
      .sort({ lastReadAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Populate comic and novel data
    const comicCollection = req.db.collection("Comic");
    const novelCollection = req.db.collection("Novel");
    const chapterCollection = req.db.collection("Chapter");
    const novelChapterCollection = req.db.collection("NovelChapter");

    const populatedHistory = await Promise.all(
      history.map(async (item) => {
        if (item.comicId) {
          const comic = await comicCollection.findOne({
            _id: item.comicId,
            subdomain: subdomain,
          });
          let chapter = null;
          if (item.chapterId) {
            chapter = await chapterCollection.findOne({
              _id: item.chapterId,
            });
          }
          return {
            ...item,
            type: "comic",
            comic: comic || null,
            chapter: chapter || null,
          };
        } else if (item.novelId) {
          const novel = await novelCollection.findOne({
            _id: item.novelId,
            subdomain: subdomain,
          });
          let chapter = null;
          if (item.novelChapterId) {
            chapter = await novelChapterCollection.findOne({
              _id: item.novelChapterId,
            });
          }
          return {
            ...item,
            type: "novel",
            novel: novel || null,
            chapter: chapter || null,
          };
        }
        return item;
      })
    );

    // Filter out history items where the comic/novel doesn't exist
    const validHistory = populatedHistory.filter(
      (item) =>
        (item.type === "comic" && item.comic) ||
        (item.type === "novel" && item.novel)
    );

    const total = await readingHistoryCollection.countDocuments({
      user: new ObjectId(userId),
      subdomain: subdomain,
    });

    res.json({
      success: true,
      history: validHistory,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get reading history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reading history",
      error: error.message,
    });
  }
});

// @route   POST /api2/webtoon/user/history
// @desc    Add or update reading history
// @access  Private
router.post("/user/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const { comicId, novelId, chapterId, novelChapterId, progress } = req.body;

    if (!comicId && !novelId) {
      return res.status(400).json({
        success: false,
        message: "Either comicId or novelId is required",
      });
    }

    // Find existing history entry using native MongoDB collection
    const readingHistoryCollection = req.db.collection("ReadingHistory");
    const existing = await readingHistoryCollection.findOne({
      user: new ObjectId(userId),
      subdomain: subdomain,
      ...(comicId
        ? { comicId: new ObjectId(comicId) }
        : { novelId: new ObjectId(novelId) }),
    });

    if (existing) {
      // Update existing entry
      const updateData = {
        lastReadAt: new Date(),
        updatedAt: new Date(),
      };
      if (chapterId) updateData.chapterId = new ObjectId(chapterId);
      if (novelChapterId)
        updateData.novelChapterId = new ObjectId(novelChapterId);
      if (progress !== undefined) updateData.progress = progress;

      await readingHistoryCollection.updateOne(
        { _id: existing._id },
        { $set: updateData }
      );

      const updatedHistory = await readingHistoryCollection.findOne({
        _id: existing._id,
      });

      return res.json({
        success: true,
        message: "Reading history updated",
        history: updatedHistory,
      });
    }

    // Create new history entry
    const history = {
      user: new ObjectId(userId),
      subdomain: subdomain,
      ...(comicId
        ? { comicId: new ObjectId(comicId) }
        : { novelId: new ObjectId(novelId) }),
      ...(chapterId ? { chapterId: new ObjectId(chapterId) } : {}),
      ...(novelChapterId
        ? { novelChapterId: new ObjectId(novelChapterId) }
        : {}),
      progress: progress || 0,
      lastReadAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await readingHistoryCollection.insertOne(history);
    const insertedHistory = await readingHistoryCollection.findOne({
      _id: result.insertedId,
    });

    res.status(201).json({
      success: true,
      message: "Reading history added",
      history: insertedHistory,
    });
  } catch (error) {
    console.error("Add reading history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add reading history",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/webtoon/user/history/:id
// @desc    Remove a reading history entry
// @access  Private
router.delete("/user/history/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subdomain = req.subdomain;
    const historyId = req.params.id;

    const readingHistoryCollection = req.db.collection("ReadingHistory");
    const history = await readingHistoryCollection.findOneAndDelete({
      _id: new ObjectId(historyId),
      user: new ObjectId(userId),
      subdomain: subdomain,
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Reading history not found",
      });
    }

    res.json({
      success: true,
      message: "Removed from reading history",
    });
  } catch (error) {
    console.error("Remove reading history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove reading history",
      error: error.message,
    });
  }
});

module.exports = router;
