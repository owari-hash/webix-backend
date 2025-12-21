const express = require("express");
const { ObjectId } = require("mongodb");
const router = express.Router();

/**
 * Unified Search Endpoint
 * Searches across Comics, Novels, Chapters, and Novel Chapters
 * Uses relevance scoring algorithm
 */

// @route   GET /api2/search
// @desc    Unified search across all content types
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { q, type, limit = 20, page = 1 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Хайлтын үг шаардлагатай",
      });
    }

    const searchQuery = q.trim();
    const searchLimit = Math.min(parseInt(limit), 50); // Max 50 results
    const skip = (parseInt(page) - 1) * searchLimit;

    const results = {
      comics: [],
      novels: [],
      chapters: [],
      novelChapters: [],
      total: 0,
    };

    // Build search regex (case-insensitive, supports partial matches)
    const searchRegex = new RegExp(
      searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    // Search Comics
    if (!type || type === "comic" || type === "all") {
      const comicCollection = req.db.collection("Comic");
      
      // Build search query with relevance scoring
      const comicQuery = {
        subdomain: req.subdomain,
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { genre: { $in: [searchRegex] } },
        ],
      };

      const comics = await comicCollection
        .find(comicQuery)
        .sort({ views: -1, likes: -1, createdAt: -1 })
        .limit(searchLimit)
        .toArray();

      // Calculate relevance score for each comic
      results.comics = comics.map((comic) => {
        let score = 0;
        const titleMatch = comic.title.match(new RegExp(searchQuery, "gi"));
        const descMatch = comic.description.match(new RegExp(searchQuery, "gi"));
        const genreMatch = comic.genre.some((g) =>
          g.match(new RegExp(searchQuery, "gi"))
        );

        // Title match gets highest score
        if (titleMatch) {
          score += 100;
          if (comic.title.toLowerCase().startsWith(searchQuery.toLowerCase())) {
            score += 50; // Exact start match bonus
          }
        }

        // Description match
        if (descMatch) {
          score += 30;
        }

        // Genre match
        if (genreMatch) {
          score += 20;
        }

        // Popularity boost
        score += Math.log10(comic.views + 1) * 5;
        score += comic.likes * 2;

        return {
          ...comic,
          type: "comic",
          relevanceScore: score,
        };
      });

      // Sort by relevance score
      results.comics.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Search Novels
    if (!type || type === "novel" || type === "all") {
      const novelCollection = req.db.collection("Novel");
      
      const novelQuery = {
        subdomain: req.subdomain,
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { genre: { $in: [searchRegex] } },
        ],
      };

      const novels = await novelCollection
        .find(novelQuery)
        .sort({ views: -1, likes: -1, createdAt: -1 })
        .limit(searchLimit)
        .toArray();

      // Calculate relevance score for each novel
      results.novels = novels.map((novel) => {
        let score = 0;
        const titleMatch = novel.title.match(new RegExp(searchQuery, "gi"));
        const descMatch = novel.description.match(new RegExp(searchQuery, "gi"));
        const genreMatch = novel.genre.some((g) =>
          g.match(new RegExp(searchQuery, "gi"))
        );

        if (titleMatch) {
          score += 100;
          if (novel.title.toLowerCase().startsWith(searchQuery.toLowerCase())) {
            score += 50;
          }
        }

        if (descMatch) {
          score += 30;
        }

        if (genreMatch) {
          score += 20;
        }

        score += Math.log10(novel.views + 1) * 5;
        score += novel.likes * 2;

        return {
          ...novel,
          type: "novel",
          relevanceScore: score,
        };
      });

      results.novels.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Search Chapters (Comic Chapters)
    if (!type || type === "chapter" || type === "all") {
      const chapterCollection = req.db.collection("Chapter");
      
      const chapterQuery = {
        subdomain: req.subdomain,
        $or: [{ title: searchRegex }],
      };

      const chapters = await chapterCollection
        .find(chapterQuery)
        .sort({ views: -1, createdAt: -1 })
        .limit(searchLimit)
        .toArray();

      // Populate comic info for chapters
      const comicCollection = req.db.collection("Comic");
      const chaptersWithComic = await Promise.all(
        chapters.map(async (chapter) => {
          const comic = await comicCollection.findOne({
            _id: chapter.comicId,
          });
          return {
            ...chapter,
            comicTitle: comic?.title || "Unknown",
            comicCover: comic?.coverImage || null,
            type: "chapter",
          };
        })
      );

      results.chapters = chaptersWithComic.map((chapter) => {
        let score = 0;
        const titleMatch = chapter.title.match(new RegExp(searchQuery, "gi"));

        if (titleMatch) {
          score += 80;
          if (chapter.title.toLowerCase().startsWith(searchQuery.toLowerCase())) {
            score += 40;
          }
        }

        // Comic title match bonus
        if (chapter.comicTitle.match(new RegExp(searchQuery, "gi"))) {
          score += 30;
        }

        score += Math.log10(chapter.views + 1) * 3;

        return {
          ...chapter,
          relevanceScore: score,
        };
      });

      results.chapters.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Search Novel Chapters
    if (!type || type === "novel-chapter" || type === "all") {
      const novelChapterCollection = req.db.collection("NovelChapter");
      
      const novelChapterQuery = {
        subdomain: req.subdomain,
        $or: [{ title: searchRegex }],
      };

      const novelChapters = await novelChapterCollection
        .find(novelChapterQuery)
        .sort({ views: -1, createdAt: -1 })
        .limit(searchLimit)
        .toArray();

      // Populate novel info
      const novelCollection = req.db.collection("Novel");
      const novelChaptersWithNovel = await Promise.all(
        novelChapters.map(async (chapter) => {
          const novel = await novelCollection.findOne({
            _id: chapter.novelId,
          });
          return {
            ...chapter,
            novelTitle: novel?.title || "Unknown",
            novelCover: novel?.coverImage || null,
            type: "novel-chapter",
          };
        })
      );

      results.novelChapters = novelChaptersWithNovel.map((chapter) => {
        let score = 0;
        const titleMatch = chapter.title.match(new RegExp(searchQuery, "gi"));

        if (titleMatch) {
          score += 80;
          if (chapter.title.toLowerCase().startsWith(searchQuery.toLowerCase())) {
            score += 40;
          }
        }

        if (chapter.novelTitle.match(new RegExp(searchQuery, "gi"))) {
          score += 30;
        }

        score += Math.log10(chapter.views + 1) * 3;

        return {
          ...chapter,
          relevanceScore: score,
        };
      });

      results.novelChapters.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Calculate total
    results.total =
      results.comics.length +
      results.novels.length +
      results.chapters.length +
      results.novelChapters.length;

    // Apply pagination to combined results
    const allResults = [
      ...results.comics,
      ...results.novels,
      ...results.chapters,
      ...results.novelChapters,
    ]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(skip, skip + searchLimit);

    res.json({
      success: true,
      query: searchQuery,
      total: results.total,
      page: parseInt(page),
      limit: searchLimit,
      pages: Math.ceil(results.total / searchLimit),
      results: allResults,
      breakdown: {
        comics: results.comics.length,
        novels: results.novels.length,
        chapters: results.chapters.length,
        novelChapters: results.novelChapters.length,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Хайлт хийхэд алдаа гарлаа",
      error: error.message,
    });
  }
});

module.exports = router;

