const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api2/comments/comic/:comicId
// @desc    Post a comment on a comic
// @access  Private
router.post("/comic/:comicId", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { content } = req.body;
    const { comicId } = req.params;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 5000 characters",
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

    const commentCollection = req.db.collection("Comment");

    const comment = {
      content: content.trim(),
      author: new ObjectId(req.user.userId),
      comicId: new ObjectId(comicId),
      chapterId: null,
      subdomain: req.subdomain,
      likes: 0,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentCollection.insertOne(comment);

    res.status(201).json({
      success: true,
      message: "Comment posted successfully",
      comment: {
        id: result.insertedId,
        ...comment,
      },
    });
  } catch (error) {
    console.error("Post comment on comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to post comment",
      error: error.message,
    });
  }
});

// @route   POST /api2/comments/chapter/:chapterId
// @desc    Post a comment on a chapter
// @access  Private
router.post("/chapter/:chapterId", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { content } = req.body;
    const { chapterId } = req.params;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 5000 characters",
      });
    }

    // Check if chapter exists
    const chapterCollection = req.db.collection("Chapter");
    const chapter = await chapterCollection.findOne({
      _id: new ObjectId(chapterId),
    });

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    const commentCollection = req.db.collection("Comment");

    const comment = {
      content: content.trim(),
      author: new ObjectId(req.user.userId),
      comicId: null,
      chapterId: new ObjectId(chapterId),
      subdomain: req.subdomain,
      likes: 0,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentCollection.insertOne(comment);

    res.status(201).json({
      success: true,
      message: "Comment posted successfully",
      comment: {
        id: result.insertedId,
        ...comment,
      },
    });
  } catch (error) {
    console.error("Post comment on chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to post comment",
      error: error.message,
    });
  }
});

// @route   GET /api2/comments/comic/:comicId
// @desc    Get all comments for a comic
// @access  Public
router.get("/comic/:comicId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { comicId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const commentCollection = req.db.collection("Comment");

    // Get comments with pagination
    const comments = await commentCollection
      .find({ comicId: new ObjectId(comicId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await commentCollection.countDocuments({
      comicId: new ObjectId(comicId),
    });

    // Populate author information
    const usersCollection = req.db.collection("users");
    const UserCollection = req.db.collection("User");

    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        let author = null;
        // Try both collection names
        author = await usersCollection.findOne(
          { _id: comment.author },
          { projection: { name: 1, email: 1, avatar: 1 } }
        );
        if (!author) {
          author = await UserCollection.findOne(
            { _id: comment.author },
            {
              projection: {
                name: 1,
                email: 1,
                avatar: 1,
                firstName: 1,
                lastName: 1,
              },
            }
          );
          if (author && (author.firstName || author.lastName)) {
            author.name = `${author.firstName || ""} ${
              author.lastName || ""
            }`.trim();
          }
        }

        return {
          ...comment,
          author: author
            ? {
                id: author._id,
                name: author.name,
                email: author.email,
                avatar: author.avatar,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      count: commentsWithAuthors.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comments: commentsWithAuthors,
    });
  } catch (error) {
    console.error("Get comments for comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: error.message,
    });
  }
});

// @route   GET /api2/comments/chapter/:chapterId
// @desc    Get all comments for a chapter
// @access  Public
router.get("/chapter/:chapterId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { chapterId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const commentCollection = req.db.collection("Comment");

    // Get comments with pagination
    const comments = await commentCollection
      .find({ chapterId: new ObjectId(chapterId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await commentCollection.countDocuments({
      chapterId: new ObjectId(chapterId),
    });

    // Populate author information
    const usersCollection = req.db.collection("users");
    const UserCollection = req.db.collection("User");

    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        let author = null;
        // Try both collection names
        author = await usersCollection.findOne(
          { _id: comment.author },
          { projection: { name: 1, email: 1, avatar: 1 } }
        );
        if (!author) {
          author = await UserCollection.findOne(
            { _id: comment.author },
            {
              projection: {
                name: 1,
                email: 1,
                avatar: 1,
                firstName: 1,
                lastName: 1,
              },
            }
          );
          if (author && (author.firstName || author.lastName)) {
            author.name = `${author.firstName || ""} ${
              author.lastName || ""
            }`.trim();
          }
        }

        return {
          ...comment,
          author: author
            ? {
                id: author._id,
                name: author.name,
                email: author.email,
                avatar: author.avatar,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      count: commentsWithAuthors.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comments: commentsWithAuthors,
    });
  } catch (error) {
    console.error("Get comments for chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: error.message,
    });
  }
});

// @route   PUT /api2/comments/:id
// @desc    Edit a comment
// @access  Private
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { content } = req.body;
    const { id } = req.params;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 5000 characters",
      });
    }

    const commentCollection = req.db.collection("Comment");

    // Find the comment first
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the author
    if (comment.author.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
    }

    // Update comment
    const result = await commentCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          content: content.trim(),
          isEdited: true,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    res.json({
      success: true,
      message: "Comment updated successfully",
      comment: result,
    });
  } catch (error) {
    console.error("Edit comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to edit comment",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;

    const commentCollection = req.db.collection("Comment");

    // Find the comment first
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the author or admin
    const isAuthor = comment.author.toString() === req.user.userId;
    const isAdmin = req.user.role === "admin";

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
    }

    // Delete comment
    const result = await commentCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: error.message,
    });
  }
});

module.exports = router;
