// OPTIMIZED COMMENT AGGREGATION PIPELINES
// This file contains optimized MongoDB aggregation pipelines to replace N+1 queries
// Import this in routes/comments.js to use the optimized versions

/**
 * Build aggregation pipeline for fetching comments with all related data
 * This replaces the N+1 query problem with a single aggregation query
 * 
 * @param {ObjectId} resourceId - Comic, Chapter, Novel, or NovelChapter ID
 * @param {string} resourceType - 'comic', 'chapter', 'novel', or 'novel-chapter'
 * @param {ObjectId|null} currentUserId - Current user ID for like status
 * @param {number} skip - Pagination skip
 * @param {number} limit - Pagination limit
 * @returns {Array} Aggregation pipeline
 */
function buildCommentsAggregationPipeline(resourceId, resourceType, currentUserId, skip, limit) {
  let matchField;
  if (resourceType === 'comic') {
    matchField = 'comicId';
  } else if (resourceType === 'chapter') {
    matchField = 'chapterId';
  } else if (resourceType === 'novel') {
    matchField = 'novelId';
  } else if (resourceType === 'novel-chapter') {
    matchField = 'novelChapterId';
  } else {
    throw new Error(`Invalid resourceType: ${resourceType}`);
  }
  
  const pipeline = [
    // Stage 1: Match top-level comments for the resource
    {
      $match: {
        [matchField]: resourceId,
        parentId: null,
      },
    },
    
    // Stage 2: Sort by creation date (newest first)
    {
      $sort: { createdAt: -1 },
    },
    
    // Stage 3: Pagination
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    
    // Stage 4: Lookup author information
    {
      $lookup: {
        from: 'User',
        localField: 'author',
        foreignField: '_id',
        as: 'authorData',
      },
    },
    
    // Stage 5: Lookup replies
    {
      $lookup: {
        from: 'Comment',
        let: { commentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$parentId', '$$commentId'] },
            },
          },
          {
            $sort: { createdAt: 1 },
          },
          {
            $limit: 50,
          },
          // Lookup author for each reply
          {
            $lookup: {
              from: 'User',
              localField: 'author',
              foreignField: '_id',
              as: 'authorData',
            },
          },
          // Lookup likes for reply (if user is authenticated)
          ...(currentUserId
            ? [
                {
                  $lookup: {
                    from: 'Like',
                    let: { replyId: '$_id' },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ['$commentId', '$$replyId'] },
                              { $eq: ['$user', currentUserId] },
                            ],
                          },
                        },
                      },
                    ],
                    as: 'userLikes',
                  },
                },
              ]
            : []),
          // Transform reply data
          {
            $addFields: {
              author: {
                $cond: {
                  if: { $gt: [{ $size: '$authorData' }, 0] },
                  then: {
                    id: { $arrayElemAt: ['$authorData._id', 0] },
                    name: { $arrayElemAt: ['$authorData.name', 0] },
                    email: { $arrayElemAt: ['$authorData.email', 0] },
                    avatar: { $arrayElemAt: ['$authorData.avatar', 0] },
                  },
                  else: null,
                },
              },
              ...(currentUserId
                ? {
                    isLiked: {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: '$userLikes',
                              cond: { $eq: ['$$this.type', 'like'] },
                            },
                          },
                        },
                        0,
                      ],
                    },
                    isDisliked: {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: '$userLikes',
                              cond: { $eq: ['$$this.type', 'dislike'] },
                            },
                          },
                        },
                        0,
                      ],
                    },
                  }
                : {
                    isLiked: false,
                    isDisliked: false,
                  }),
            },
          },
          // Remove temporary fields
          {
            $project: {
              authorData: 0,
              userLikes: 0,
            },
          },
        ],
        as: 'replies',
      },
    },
    
    // Stage 6: Count replies
    {
      $lookup: {
        from: 'Comment',
        let: { commentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$parentId', '$$commentId'] },
            },
          },
          {
            $count: 'count',
          },
        ],
        as: 'replyCountData',
      },
    },
    
    // Stage 7: Lookup user's like/dislike status (if authenticated)
    ...(currentUserId
      ? [
          {
            $lookup: {
              from: 'Like',
              let: { commentId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$commentId', '$$commentId'] },
                        { $eq: ['$user', currentUserId] },
                      ],
                    },
                  },
                },
              ],
              as: 'userLikes',
            },
          },
        ]
      : []),
    
    // Stage 8: Transform and clean up data
    {
      $addFields: {
        author: {
          $cond: {
            if: { $gt: [{ $size: '$authorData' }, 0] },
            then: {
              id: { $arrayElemAt: ['$authorData._id', 0] },
              name: { $arrayElemAt: ['$authorData.name', 0] },
              email: { $arrayElemAt: ['$authorData.email', 0] },
              avatar: { $arrayElemAt: ['$authorData.avatar', 0] },
            },
            else: null,
          },
        },
        replyCount: {
          $cond: {
            if: { $gt: [{ $size: '$replyCountData' }, 0] },
            then: { $arrayElemAt: ['$replyCountData.count', 0] },
            else: 0,
          },
        },
        ...(currentUserId
          ? {
              isLiked: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$userLikes',
                        cond: { $eq: ['$$this.type', 'like'] },
                      },
                    },
                  },
                  0,
                ],
              },
              isDisliked: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$userLikes',
                        cond: { $eq: ['$$this.type', 'dislike'] },
                      },
                    },
                  },
                  0,
                ],
              },
            }
          : {
              isLiked: false,
              isDisliked: false,
            }),
      },
    },
    
    // Stage 9: Remove temporary fields
    {
      $project: {
        authorData: 0,
        replyCountData: 0,
        userLikes: 0,
      },
    },
  ];
  
  return pipeline;
}

/**
 * Get comments count for pagination
 */
async function getCommentsCount(db, resourceId, resourceType) {
  let matchField;
  if (resourceType === 'comic') {
    matchField = 'comicId';
  } else if (resourceType === 'chapter') {
    matchField = 'chapterId';
  } else if (resourceType === 'novel') {
    matchField = 'novelId';
  } else if (resourceType === 'novel-chapter') {
    matchField = 'novelChapterId';
  } else {
    throw new Error(`Invalid resourceType: ${resourceType}`);
  }
  
  const commentCollection = db.collection('Comment');
  
  return await commentCollection.countDocuments({
    [matchField]: resourceId,
    parentId: null,
  });
}

module.exports = {
  buildCommentsAggregationPipeline,
  getCommentsCount,
};
