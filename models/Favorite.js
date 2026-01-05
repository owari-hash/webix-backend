const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    comicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comic",
      default: null,
    },
    novelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Novel",
      default: null,
    },
    subdomain: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validation: Exactly one of comicId or novelId must be provided
favoriteSchema.pre("validate", function (next) {
  const targets = [this.comicId, this.novelId].filter((t) => t !== null);
  if (targets.length !== 1) {
    return next(
      new Error("Exactly one of comicId or novelId must be provided")
    );
  }
  next();
});

// Unique index to prevent duplicate favorites per user
favoriteSchema.index(
  { user: 1, comicId: 1 },
  { unique: true, sparse: true }
);
favoriteSchema.index(
  { user: 1, novelId: 1 },
  { unique: true, sparse: true }
);
favoriteSchema.index({ user: 1, subdomain: 1, createdAt: -1 });

module.exports = mongoose.model("Favorite", favoriteSchema);


