const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api2/webtoon/comic
// @desc    Create a new comic
// @access  Private
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

// @route   GET /api2/webtoon/comic/:id
// @desc    Get single comic
// @access  Public
router.get("/comic/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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

// @route   GET /api2/webtoon/comic/:comicId/chapters
// @desc    Get all chapters of a comic
// @access  Public
router.get("/comic/:comicId/chapters", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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

// ==================== NOVEL ROUTES ====================

// @route   POST /api2/webtoon/novel
// @desc    Create a new novel
// @access  Private
router.post("/novel", authenticate, async (req, res) => {
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

// @route   GET /api2/webtoon/novels
// @desc    Get all novels
// @access  Public
router.get("/novels", async (req, res) => {
  try {
    const collection = req.db.collection("Novel");
    const novels = await collection.find({}).sort({ createdAt: -1 }).toArray();

    res.json({
      success: true,
      count: novels.length,
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

// @route   GET /api2/webtoon/novel/:id
// @desc    Get single novel
// @access  Public
router.get("/novel/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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

// @route   PUT /api2/webtoon/novel/:id
// @desc    Update novel
// @access  Private
router.put("/novel/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { title, description, coverImage, genre, status } = req.body;
    const collection = req.db.collection("Novel");

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

// @route   DELETE /api2/webtoon/novel/:id
// @desc    Delete novel
// @access  Private
router.delete("/novel/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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

// @route   POST /api2/webtoon/novel/:novelId/chapter
// @desc    Add chapter to novel
// @access  Private
router.post("/novel/:novelId/chapter", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { chapterNumber, title, content } = req.body;
    const { novelId } = req.params;

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

// @route   GET /api2/webtoon/novel/:novelId/chapters
// @desc    Get all chapters of a novel
// @access  Public
router.get("/novel/:novelId/chapters", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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

// @route   GET /api2/webtoon/novel-chapter/:id
// @desc    Get single novel chapter
// @access  Public
router.get("/novel-chapter/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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

// @route   PUT /api2/webtoon/novel-chapter/:id
// @desc    Update novel chapter
// @access  Private
router.put("/novel-chapter/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { title, content } = req.body;
    const collection = req.db.collection("NovelChapter");

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

// @route   DELETE /api2/webtoon/novel-chapter/:id
// @desc    Delete novel chapter
// @access  Private
router.delete("/novel-chapter/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
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
