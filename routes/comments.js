const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api2/comments/comic/:comicId
// @desc    Post a comment on a comic
// @access  Private
router.post("/comic/:comicId", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { deleteCachePattern } = require("../utils/redis");
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

    // Invalidate cache for this comic's comments
    await deleteCachePattern(`comments:comic:${comicId}:*`);

    // Track achievement: comment posted
    try {
      const { trackComment } = require("../utils/achievementService");
      await trackComment(req.db, req.user.userId, req.subdomain);
    } catch (achievementError) {
      console.error("Error tracking comment achievement:", achievementError);
      // Don't fail the request if achievement tracking fails
    }

    // Populate author before returning
    const populatedAuthor = await populateAuthor(
      req.db,
      new ObjectId(req.user.userId)
    );

    res.status(201).json({
      success: true,
      message: "Comment posted successfully",
      comment: {
        id: result.insertedId,
        ...comment,
        author: populatedAuthor || {
          id: req.user.userId,
          name: req.user.email || "User",
          email: req.user.email || "",
          avatar: null,
        },
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

// @route   POST /api2/comments/novel/:novelId
// @desc    Post a comment on a novel
// @access  Private
router.post("/novel/:novelId", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { deleteCachePattern } = require("../utils/redis");
    const { content } = req.body;
    const { novelId } = req.params;

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

    const commentCollection = req.db.collection("Comment");

    const comment = {
      content: content.trim(),
      author: new ObjectId(req.user.userId),
      novelId: new ObjectId(novelId),
      novelChapterId: null,
      comicId: null,
      chapterId: null,
      novelId: null,
      novelChapterId: null,
      subdomain: req.subdomain,
      likes: 0,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentCollection.insertOne(comment);

    // Invalidate cache for this novel's comments
    await deleteCachePattern(`comments:novel:${novelId}:*`);

    // Track achievement: comment posted
    try {
      const { trackComment } = require("../utils/achievementService");
      await trackComment(req.db, req.user.userId, req.subdomain);
    } catch (achievementError) {
      console.error("Error tracking comment achievement:", achievementError);
      // Don't fail the request if achievement tracking fails
    }

    // Populate author before returning
    const populatedAuthor = await populateAuthor(
      req.db,
      new ObjectId(req.user.userId)
    );

    res.status(201).json({
      success: true,
      message: "Comment posted successfully",
      comment: {
        id: result.insertedId,
        ...comment,
        author: populatedAuthor || {
          id: req.user.userId,
          name: req.user.email || "User",
          email: req.user.email || "",
          avatar: null,
        },
      },
    });
  } catch (error) {
    console.error("Post comment on novel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to post comment",
      error: error.message,
    });
  }
});

// @route   POST /api2/comments/novel-chapter/:novelChapterId
// @desc    Post a comment on a novel chapter
// @access  Private
router.post(
  "/novel-chapter/:novelChapterId",
  authenticate,
  async (req, res) => {
    try {
      const { ObjectId } = require("mongodb");
      const { deleteCachePattern } = require("../utils/redis");
      const { content } = req.body;
      const { novelChapterId } = req.params;

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

      // Check if novel chapter exists
      const chapterCollection = req.db.collection("NovelChapter");
      const chapter = await chapterCollection.findOne({
        _id: new ObjectId(novelChapterId),
      });

      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: "Novel chapter not found",
        });
      }

      const commentCollection = req.db.collection("Comment");

      const comment = {
        content: content.trim(),
        author: new ObjectId(req.user.userId),
        novelId: null,
        novelChapterId: new ObjectId(novelChapterId),
        comicId: null,
        chapterId: null,
        novelId: null,
        novelChapterId: null,
        subdomain: req.subdomain,
        likes: 0,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await commentCollection.insertOne(comment);

      // Invalidate cache for this chapter's comments
      await deleteCachePattern(`comments:novel-chapter:${novelChapterId}:*`);

      // Track achievement: comment posted
      try {
        const { trackComment } = require("../utils/achievementService");
        await trackComment(req.db, req.user.userId, req.subdomain);
      } catch (achievementError) {
        console.error("Error tracking comment achievement:", achievementError);
        // Don't fail the request if achievement tracking fails
      }

      // Populate author before returning
      const populatedAuthor = await populateAuthor(
        req.db,
        new ObjectId(req.user.userId)
      );

      res.status(201).json({
        success: true,
        message: "Comment posted successfully",
        comment: {
          id: result.insertedId,
          ...comment,
          author: populatedAuthor || {
            id: req.user.userId,
            name: req.user.email || "User",
            email: req.user.email || "",
            avatar: null,
          },
        },
      });
    } catch (error) {
      console.error("Post comment on novel chapter error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to post comment",
        error: error.message,
      });
    }
  }
);

// @route   POST /api2/comments/chapter/:chapterId
// @desc    Post a comment on a chapter
// @access  Private
router.post("/chapter/:chapterId", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { deleteCachePattern } = require("../utils/redis");
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

    // Invalidate cache for this chapter's comments
    await deleteCachePattern(`comments:chapter:${chapterId}:*`);

    // Track achievement: comment posted
    try {
      const { trackComment } = require("../utils/achievementService");
      await trackComment(req.db, req.user.userId, req.subdomain);
    } catch (achievementError) {
      console.error("Error tracking comment achievement:", achievementError);
      // Don't fail the request if achievement tracking fails
    }

    // Populate author before returning
    const populatedAuthor = await populateAuthor(
      req.db,
      new ObjectId(req.user.userId)
    );

    res.status(201).json({
      success: true,
      message: "Comment posted successfully",
      comment: {
        id: result.insertedId,
        ...comment,
        author: populatedAuthor || {
          id: req.user.userId,
          name: req.user.email || "User",
          email: req.user.email || "",
          avatar: null,
        },
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

const { notifyUser } = require("../utils/notifications");

// @route   POST /api2/comments/:commentId/reply
// @desc    Reply to a comment
// @access  Private
router.post("/:commentId/reply", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { content } = req.body;
    const { commentId } = req.params;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reply content is required",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Reply cannot exceed 5000 characters",
      });
    }

    const commentCollection = req.db.collection("Comment");

    // Find the parent comment
    const parentComment = await commentCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }

    // Create reply - inherit comicId/chapterId/novelId/novelChapterId from parent
    const reply = {
      content: content.trim(),
      author: new ObjectId(req.user.userId),
      parentId: new ObjectId(commentId),
      comicId: parentComment.comicId || null,
      chapterId: parentComment.chapterId || null,
      novelId: parentComment.novelId || null,
      novelChapterId: parentComment.novelChapterId || null,
      subdomain: req.subdomain,
      likes: 0,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await commentCollection.insertOne(reply);

    // Notify parent comment author if different from replier
    try {
      if (
        parentComment.author &&
        parentComment.author.toString() !== req.user.userId
      ) {
        await notifyUser({
          tenantDb: req.db,
          userId: parentComment.author,
          subdomain: req.subdomain,
          type: "comment_reply",
          title: "Таны сэтгэгдэлд хариу бичлээ",
          message: reply.content.slice(0, 120),
          metadata: {
            parentCommentId: parentComment._id,
            replyId: result.insertedId,
            comicId: parentComment.comicId || null,
            chapterId: parentComment.chapterId || null,
            novelId: parentComment.novelId || null,
            novelChapterId: parentComment.novelChapterId || null,
          },
        });
      }
    } catch (notifError) {
      console.error("Reply notification error:", notifError);
      // Do not fail the main request on notification error
    }

    // Populate author before returning
    const populatedAuthor = await populateAuthor(
      req.db,
      new ObjectId(req.user.userId)
    );

    res.status(201).json({
      success: true,
      message: "Reply posted successfully",
      reply: {
        id: result.insertedId,
        ...reply,
        author: populatedAuthor || {
          id: req.user.userId,
          name: req.user.email || "User",
          email: req.user.email || "",
          avatar: null,
        },
      },
    });
  } catch (error) {
    console.error("Post reply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to post reply",
      error: error.message,
    });
  }
});

// Helper function to populate author info
async function populateAuthor(db, authorId) {
  const usersCollection = db.collection("users");
  const UserCollection = db.collection("User");

  let author = await usersCollection.findOne(
    { _id: authorId },
    {
      projection: {
        name: 1,
        email: 1,
        avatar: 1,
      },
    }
  );

  if (!author) {
    author = await UserCollection.findOne(
      { _id: authorId },
      {
        projection: {
          name: 1,
          email: 1,
          avatar: 1,
        },
      }
    );
  }

  if (!author) {
    return null;
  }

  // Determine the best name to use
  let authorName = author.name;
  // If name is empty or null, use email prefix
  if (!authorName || authorName.trim() === "") {
    if (author.email) {
      authorName = author.email.split("@")[0];
    } else {
      authorName = "Нэргүй хэрэглэгч";
    }
  }

  return {
    id: author._id,
    name: authorName,
    email: author.email,
    avatar: author.avatar,
  };
}

// Helper function to fetch replies for a comment
async function fetchReplies(db, parentId, limit = 50, currentUserId = null) {
  const commentCollection = db.collection("Comment");
  const replies = await commentCollection
    .find({ parentId: parentId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();

  const repliesWithAuthors = await Promise.all(
    replies.map(async (reply) => {
      const author = await populateAuthor(db, reply.author);

      // Check if current user liked/disliked this reply
      let isLiked = false;
      let isDisliked = false;
      if (currentUserId) {
        const likeCollection = db.collection("Like");
        const like = await likeCollection.findOne({
          user: currentUserId,
          commentId: reply._id,
          type: "like",
        });
        const dislike = await likeCollection.findOne({
          user: currentUserId,
          commentId: reply._id,
          type: "dislike",
        });
        isLiked = !!like;
        isDisliked = !!dislike;
      }

      return {
        ...reply,
        author,
        isLiked,
        isDisliked,
      };
    })
  );

  return repliesWithAuthors;
}

// @route   GET /api2/comments/comic/:comicId
// @desc    Get all comments for a comic (OPTIMIZED with aggregation)
// @access  Public
router.get("/comic/:comicId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { comicId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Import optimized aggregation
    const {
      buildCommentsAggregationPipeline,
      getCommentsCount,
    } = require("../utils/commentAggregation");
    const { getCache, setCache } = require("../utils/redis");

    // Get current user ID if authenticated (for like status)
    let currentUserId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET =
          process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
        const token = req.headers.authorization.split(" ")[1];
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          currentUserId = new ObjectId(decoded.userId);
        }
      } catch (e) {
        // Not authenticated, that's okay
      }
    }

    // Try cache first (only for non-authenticated users)
    const cacheKey = `comments:comic:${comicId}:page:${page}:limit:${limit}`;
    if (!currentUserId) {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);

    const commentCollection = req.db.collection("Comment");
    const resourceId = new ObjectId(comicId);

    // Get total count
    const total = await getCommentsCount(req.db, resourceId, "comic");

    // Build and execute aggregation pipeline
    const pipeline = buildCommentsAggregationPipeline(
      resourceId,
      "comic",
      currentUserId,
      skip,
      limit
    );

    const comments = await commentCollection.aggregate(pipeline).toArray();

    const response = {
      success: true,
      count: comments.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comments,
    };

    // Cache for 5 minutes (only for non-authenticated users)
    if (!currentUserId) {
      await setCache(cacheKey, response, 300);
    }

    res.json(response);
  } catch (error) {
    console.error("Get comments for comic error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: error.message,
    });
  }
});

// @route   GET /api2/comments/novel/:novelId
// @desc    Get all comments for a novel (OPTIMIZED with aggregation)
// @access  Public
router.get("/novel/:novelId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { novelId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Import optimized aggregation
    const {
      buildCommentsAggregationPipeline,
      getCommentsCount,
    } = require("../utils/commentAggregation");
    const { getCache, setCache } = require("../utils/redis");

    // Get current user ID if authenticated (for like status)
    let currentUserId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET =
          process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
        const token = req.headers.authorization.split(" ")[1];
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          currentUserId = new ObjectId(decoded.userId);
        }
      } catch (e) {
        // Not authenticated, that's okay
      }
    }

    // Try cache first (only for non-authenticated users)
    const cacheKey = `comments:novel:${novelId}:page:${page}:limit:${limit}`;
    if (!currentUserId) {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);

    const commentCollection = req.db.collection("Comment");
    const resourceId = new ObjectId(novelId);

    // Get total count
    const total = await getCommentsCount(req.db, resourceId, "novel");

    // Build and execute aggregation pipeline
    const pipeline = buildCommentsAggregationPipeline(
      resourceId,
      "novel",
      currentUserId,
      skip,
      limit
    );

    const comments = await commentCollection.aggregate(pipeline).toArray();

    const response = {
      success: true,
      count: comments.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comments,
    };

    // Cache for 5 minutes (only for non-authenticated users)
    if (!currentUserId) {
      await setCache(cacheKey, response, 300);
    }

    res.json(response);
  } catch (error) {
    console.error("Get comments for novel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: error.message,
    });
  }
});

// @route   GET /api2/comments/novel-chapter/:novelChapterId
// @desc    Get all comments for a novel chapter (OPTIMIZED with aggregation)
// @access  Public
router.get("/novel-chapter/:novelChapterId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { novelChapterId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Import optimized aggregation
    const {
      buildCommentsAggregationPipeline,
      getCommentsCount,
    } = require("../utils/commentAggregation");
    const { getCache, setCache } = require("../utils/redis");

    // Get current user ID if authenticated (for like status)
    let currentUserId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET =
          process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
        const token = req.headers.authorization.split(" ")[1];
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          currentUserId = new ObjectId(decoded.userId);
        }
      } catch (e) {
        // Not authenticated, that's okay
      }
    }

    // Try cache first (only for non-authenticated users)
    const cacheKey = `comments:novel-chapter:${novelChapterId}:page:${page}:limit:${limit}`;
    if (!currentUserId) {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);

    const commentCollection = req.db.collection("Comment");
    const resourceId = new ObjectId(novelChapterId);

    // Get total count
    const total = await getCommentsCount(req.db, resourceId, "novel-chapter");

    // Build and execute aggregation pipeline
    const pipeline = buildCommentsAggregationPipeline(
      resourceId,
      "novel-chapter",
      currentUserId,
      skip,
      limit
    );

    const comments = await commentCollection.aggregate(pipeline).toArray();

    const response = {
      success: true,
      count: comments.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comments,
    };

    // Cache for 5 minutes (only for non-authenticated users)
    if (!currentUserId) {
      await setCache(cacheKey, response, 300);
    }

    res.json(response);
  } catch (error) {
    console.error("Get comments for novel chapter error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: error.message,
    });
  }
});

// @route   GET /api2/comments/chapter/:chapterId
// @desc    Get all comments for a chapter (OPTIMIZED with aggregation)
// @access  Public
router.get("/chapter/:chapterId", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { chapterId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Import optimized aggregation
    const {
      buildCommentsAggregationPipeline,
      getCommentsCount,
    } = require("../utils/commentAggregation");
    const { getCache, setCache } = require("../utils/redis");

    // Get current user ID if authenticated (for like status)
    let currentUserId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET =
          process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
        const token = req.headers.authorization.split(" ")[1];
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          currentUserId = new ObjectId(decoded.userId);
        }
      } catch (e) {
        // Not authenticated, that's okay
      }
    }

    // Try cache first (only for non-authenticated users)
    const cacheKey = `comments:chapter:${chapterId}:page:${page}:limit:${limit}`;
    if (!currentUserId) {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);

    const commentCollection = req.db.collection("Comment");
    const resourceId = new ObjectId(chapterId);

    // Get total count
    const total = await getCommentsCount(req.db, resourceId, "chapter");

    // Build and execute aggregation pipeline
    const pipeline = buildCommentsAggregationPipeline(
      resourceId,
      "chapter",
      currentUserId,
      skip,
      limit
    );

    const comments = await commentCollection.aggregate(pipeline).toArray();

    const response = {
      success: true,
      count: comments.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      comments,
    };

    // Cache for 5 minutes (only for non-authenticated users)
    if (!currentUserId) {
      await setCache(cacheKey, response, 300);
    }

    res.json(response);
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

    // Delete comment and all its replies
    const result = await commentCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Delete all replies to this comment
    await commentCollection.deleteMany({
      parentId: new ObjectId(id),
    });

    res.json({
      success: true,
      message: "Comment and its replies deleted successfully",
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

// @route   POST /api2/comments/:id/like
// @desc    Like a comment
// @access  Private
router.post("/:id/like", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user already liked this comment
    const existingLike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "like",
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: "You have already liked this comment",
      });
    }

    // Check if user has disliked this comment - remove dislike first
    const existingDislike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "dislike",
    });

    if (existingDislike) {
      // Remove dislike and decrement unLikes count
      await likeCollection.deleteOne({ _id: existingDislike._id });
      const unLikesCount = Math.max(0, (comment.unLikes || 0) - 1);
      await commentCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { unLikes: unLikesCount } }
      );
    }

    // Add the like and increment count
    const like = {
      user: userId,
      commentId: new ObjectId(id),
      comicId: null,
      chapterId: null,
      novelId: null,
      novelChapterId: null,
      subdomain: req.subdomain,
      type: "like",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await likeCollection.insertOne(like);

    const likesCount = (comment.likes || 0) + 1;
    await commentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { likes: likesCount } }
    );

    // Track achievement: like given and received + notify comment author
    try {
      const {
        trackLikeGiven,
        trackLikeReceived,
      } = require("../utils/achievementService");
      await trackLikeGiven(req.db, req.user.userId, req.subdomain, true);
      // Track for comment author
      if (comment.author && comment.author.toString() !== req.user.userId) {
        await trackLikeReceived(req.db, comment.author, req.subdomain);

        // Send notification to comment author
        await notifyUser({
          tenantDb: req.db,
          userId: comment.author,
          subdomain: req.subdomain,
          type: "comment_like",
          title: "Таны сэтгэгдэлд like дарлаа",
          message: comment.content.slice(0, 120),
          metadata: {
            commentId: comment._id,
          },
        });
      }
    } catch (achievementError) {
      console.error(
        "Error tracking like/notification achievement:",
        achievementError
      );
      // Don't fail the request if achievement tracking fails or notification fails
    }

    res.json({
      success: true,
      message: "Comment liked successfully",
      isLiked: true,
      likes: likesCount,
    });
  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to like comment",
      error: error.message,
    });
  }
});

// @route   POST /api2/comments/:id/unlike
// @desc    Unlike a comment
// @access  Private
router.post("/:id/unlike", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user liked this comment
    const existingLike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "like",
    });

    if (!existingLike) {
      return res.status(400).json({
        success: false,
        message: "You have not liked this comment",
      });
    }

    // Remove the like and decrement count
    await likeCollection.deleteOne({
      _id: existingLike._id,
    });

    const likesCount = Math.max(0, (comment.likes || 0) - 1);
    await commentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { likes: likesCount } }
    );

    res.json({
      success: true,
      message: "Comment unliked successfully",
      isLiked: false,
      likes: likesCount,
      unLikes: comment.unLikes || 0,
    });
  } catch (error) {
    console.error("Unlike comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlike comment",
      error: error.message,
    });
  }
});

// @route   POST /api2/comments/:id/dislike
// @desc    Dislike a comment
// @access  Private
router.post("/:id/dislike", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user already disliked this comment
    const existingDislike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "dislike",
    });

    if (existingDislike) {
      return res.status(400).json({
        success: false,
        message: "You have already disliked this comment",
      });
    }

    // Check if user has liked this comment - remove like first
    const existingLike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "like",
    });

    if (existingLike) {
      // Remove like and decrement likes count
      await likeCollection.deleteOne({ _id: existingLike._id });
      const likesCount = Math.max(0, (comment.likes || 0) - 1);
      await commentCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { likes: likesCount } }
      );
    }

    // Add the dislike and increment unLikes count
    const dislike = {
      user: userId,
      commentId: new ObjectId(id),
      comicId: null,
      chapterId: null,
      novelId: null,
      novelChapterId: null,
      subdomain: req.subdomain,
      type: "dislike",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await likeCollection.insertOne(dislike);

    const unLikesCount = (comment.unLikes || 0) + 1;
    await commentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { unLikes: unLikesCount } }
    );

    res.json({
      success: true,
      message: "Comment disliked successfully",
      isLiked: false,
      isDisliked: true,
      likes: comment.likes || 0,
      unLikes: unLikesCount,
    });
  } catch (error) {
    console.error("Dislike comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to dislike comment",
      error: error.message,
    });
  }
});

// @route   POST /api2/comments/:id/undislike
// @desc    Undislike a comment
// @access  Private
router.post("/:id/undislike", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user disliked this comment
    const existingDislike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "dislike",
    });

    if (!existingDislike) {
      return res.status(400).json({
        success: false,
        message: "You have not disliked this comment",
      });
    }

    // Remove the dislike and decrement unLikes count
    await likeCollection.deleteOne({
      _id: existingDislike._id,
    });

    const unLikesCount = Math.max(0, (comment.unLikes || 0) - 1);
    await commentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { unLikes: unLikesCount } }
    );

    res.json({
      success: true,
      message: "Comment undisliked successfully",
      isLiked: false,
      isDisliked: false,
      likes: comment.likes || 0,
      unLikes: unLikesCount,
    });
  } catch (error) {
    console.error("Undislike comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to undislike comment",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/comments/:id/dislike
// @desc    Undislike a comment
// @access  Private
router.delete("/:id/dislike", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user disliked this comment
    const existingDislike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "dislike",
    });

    if (!existingDislike) {
      return res.status(400).json({
        success: false,
        message: "You have not disliked this comment",
      });
    }

    // Remove the dislike and decrement unLikes count
    await likeCollection.deleteOne({
      _id: existingDislike._id,
    });

    const unLikesCount = Math.max(0, (comment.unLikes || 0) - 1);
    await commentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { unLikes: unLikesCount } }
    );

    res.json({
      success: true,
      message: "Comment undisliked successfully",
      isLiked: false,
      isDisliked: false,
      likes: comment.likes || 0,
      unLikes: unLikesCount,
    });
  } catch (error) {
    console.error("Undislike comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to undislike comment",
      error: error.message,
    });
  }
});

// @route   DELETE /api2/comments/:id/like
// @desc    Unlike a comment
// @access  Private
router.delete("/:id/like", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user liked this comment
    const existingLike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "like",
    });

    if (!existingLike) {
      return res.status(400).json({
        success: false,
        message: "You have not liked this comment",
      });
    }

    // Remove the like and decrement count
    await likeCollection.deleteOne({
      _id: existingLike._id,
    });

    const likesCount = Math.max(0, (comment.likes || 0) - 1);
    await commentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { likes: likesCount } }
    );

    res.json({
      success: true,
      message: "Comment unliked successfully",
      isLiked: false,
      isDisliked: false,
      likes: likesCount,
      unLikes: comment.unLikes || 0,
    });
  } catch (error) {
    console.error("Unlike comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlike comment",
      error: error.message,
    });
  }
});

// @route   GET /api2/comments/:id/likes
// @desc    Get like status for a comment (check if current user liked it)
// @access  Private
router.get("/:id/likes", authenticate, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const { id } = req.params;
    const userId = new ObjectId(req.user.userId);

    const commentCollection = req.db.collection("Comment");
    const likeCollection = req.db.collection("Like");

    // Check if comment exists
    const comment = await commentCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { likes: 1 } }
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user liked or disliked this comment
    const existingLike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "like",
    });
    const existingDislike = await likeCollection.findOne({
      user: userId,
      commentId: new ObjectId(id),
      type: "dislike",
    });

    res.json({
      success: true,
      isLiked: !!existingLike,
      isDisliked: !!existingDislike,
      likes: comment.likes || 0,
      unLikes: comment.unLikes || 0,
    });
  } catch (error) {
    console.error("Get comment likes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comment likes",
      error: error.message,
    });
  }
});

module.exports = router;
