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
// @desc    Get all comics
// @access  Public
router.get("/comics", async (req, res) => {
  try {
    const collection = req.db.collection("Comic");
    const comics = await collection.find({}).sort({ createdAt: -1 }).toArray();

    res.json({
      success: true,
      count: comics.length,
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
    const { ObjectId } = require("mongodb");
    const { chapterNumber, title, images } = req.body;
    const { comicId } = req.params;

    if (!chapterNumber || !title || !images || !Array.isArray(images)) {
      return res.status(400).json({
        success: false,
        message: "Chapter number, title, and images array are required",
      });
    }

    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
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

    const result = await chapterCollection.insertOne(chapter);

    res.status(201).json({
      success: true,
      message: "Chapter added successfully",
      chapter: {
        id: result.insertedId,
        ...chapter,
      },
    });
  } catch (error) {
    console.error("Add chapter error:", error);
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

    res.json({
      success: true,
      count: chapters.length,
      chapters,
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
    const { ObjectId } = require("mongodb");
    const { images, append } = req.body;
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

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      updateOperation,
      { returnDocument: "after" }
    );

    res.json({
      success: true,
      message: append
        ? `${images.length} images appended successfully`
        : "Images updated successfully",
      chapter: result,
      totalImages: result.images.length,
    });
  } catch (error) {
    console.error("Append images error:", error);
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

module.exports = router;
