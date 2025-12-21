const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Helper function to validate ObjectId
function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// @route   POST /api2/novel
// @desc    Create a new novel
// @access  Private
const { notifyAdmins } = require("../utils/notifications");

router.post("/", authenticate, async (req, res) => {
  try {
    const { title, description, coverImage, genre, status } = req.body;

    if (!title || !description || !coverImage) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and cover image are required",
      });
    }

    const collection = req.db.collection("Novel");

    const novel = {
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

    const result = await collection.insertOne(novel);

    // Notify admins that a new novel was created
    try {
      await notifyAdmins({
        tenantDb: req.db,
        subdomain: req.subdomain,
        type: "content_new_novel",
        title: "Шинэ новел нэмэгдлээ",
        message: novel.title,
        metadata: {
          novelId: result.insertedId,
        },
      });
    } catch (notifError) {
      console.error("New novel notification error:", notifError);
      // Do not fail the main request on notification error
    }

    res.status(201).json({
      success: true,
      message: "Novel created successfully",
      novel: {
        id: result.insertedId,
        ...novel,
      },
    });
  } catch (error) {
    console.error("Create novel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create novel",
      error: error.message,
    });
  }
});

// @route   GET /api2/novel
// @desc    Get all novels with pagination
// @access  Public
router.get("/", async (req, res) => {
  try {
    const collection = req.db.collection("Novel");
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Get total count
    const total = await collection.countDocuments({});

    // Get paginated novels
    const novels = await collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      success: true,
      count: novels.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data: novels,
      novels,
    });
  } catch (error) {
    console.error("Get novels error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get novels",
      error: error.message,
    });
  }
});

// @route   GET /api2/novel/:id
// @desc    Get single novel
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");

    // Validate ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid novel ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("Novel");

    const novel = await collection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!novel) {
      return res.status(404).json({
        success: false,
        message: "Novel not found",
      });
    }

    res.json({
      success: true,
      novel,
    });
  } catch (error) {
    console.error("Get novel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get novel",
      error: error.message,
    });
  }
});

// @route   PUT /api2/novel/:id
// @desc    Update novel
// @access  Private
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { title, description, coverImage, genre, status } = req.body;
    const collection = req.db.collection("Novel");

    // Validate ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid novel ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

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
        message: "Novel not found or unauthorized",
      });
    }

    res.json({
      success: true,
      message: "Novel updated successfully",
      novel: result,
    });
  } catch (error) {
    console.error("Update novel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update novel",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/novel/:id
// @desc    Delete novel
// @access  Private
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    
    // Validate ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid novel ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("Novel");

    const result = await collection.deleteOne({
      _id: new ObjectId(req.params.id),
      author: req.user.userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Novel not found or unauthorized",
      });
    }

    // Also delete all chapters of this novel
    const chapterCollection = req.db.collection("NovelChapter");
    const chapters = await chapterCollection
      .find({ novelId: new ObjectId(req.params.id) })
      .toArray();
    const chapterIds = chapters.map((ch) => ch._id);

    await chapterCollection.deleteMany({
      novelId: new ObjectId(req.params.id),
    });

    // Delete all comments on this novel and its chapters
    const commentCollection = req.db.collection("Comment");
    await commentCollection.deleteMany({
      $or: [
        { novelId: new ObjectId(req.params.id) },
        { novelChapterId: { $in: chapterIds } },
      ],
    });

    res.json({
      success: true,
      message: "Novel, chapters, and comments deleted successfully",
    });
  } catch (error) {
    console.error("Delete novel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete novel",
      error: error.message,
    });
  }
});

// @route   POST /api2/novel/:novelId/chapter
// @desc    Add chapter to novel
// @access  Private
router.post("/:novelId/chapter", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { chapterNumber, title, content } = req.body;
    const { novelId } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(novelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid novel ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    if (!chapterNumber || !title || !content) {
      return res.status(400).json({
        success: false,
        message: "Chapter number, title, and content are required",
      });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Chapter content cannot be empty",
      });
    }

    // Check if novel exists
    const novelCollection = req.db.collection("Novel");
    const novel = await novelCollection.findOne({
      _id: new ObjectId(novelId),
    });

    if (!novel) {
      return res.status(404).json({
        success: false,
        message: "Novel not found",
      });
    }

    const chapterCollection = req.db.collection("NovelChapter");

    // Check if chapter number already exists
    const existingChapter = await chapterCollection.findOne({
      novelId: new ObjectId(novelId),
      chapterNumber,
    });

    if (existingChapter) {
      return res.status(400).json({
        success: false,
        message: "Chapter number already exists for this novel",
      });
    }

    const chapter = {
      novelId: new ObjectId(novelId),
      chapterNumber,
      title,
      content: content.trim(),
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

// @route   GET /api2/novel/:novelId/chapters
// @desc    Get all chapters of a novel
// @access  Public
router.get("/:novelId/chapters", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");

    // Validate ObjectId
    if (!isValidObjectId(req.params.novelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid novel ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const collection = req.db.collection("NovelChapter");

    const chapters = await collection
      .find({ novelId: new ObjectId(req.params.novelId) })
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

// @route   GET /api2/novel/chapter/:id
// @desc    Get single novel chapter
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

    const collection = req.db.collection("NovelChapter");

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

// @route   PUT /api2/novel/chapter/:id
// @desc    Update novel chapter
// @access  Private
router.put("/chapter/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { title, content } = req.body;
    const collection = req.db.collection("NovelChapter");

    // Validate ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chapter ID format",
        error: "ID must be a valid 24-character hex string",
      });
    }

    const updateFields = { updatedAt: new Date() };
    if (title) updateFields.title = title;
    if (content) {
      if (content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Chapter content cannot be empty",
        });
      }
      updateFields.content = content.trim();
    }

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

// @route   DELETE /api2/novel/chapter/:id
// @desc    Delete novel chapter
// @access  Private
router.delete("/chapter/:id", authenticate, async (req, res) => {
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

    const collection = req.db.collection("NovelChapter");

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
      novelChapterId: new ObjectId(req.params.id),
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

module.exports = router;


