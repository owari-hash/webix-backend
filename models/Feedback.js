const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    // Type: санал (suggestion), хүсэл (request), гомдол (complaint)
    type: {
      type: String,
      required: true,
      enum: ["санал", "хүсэл", "гомдол"], // suggestion, request, complaint
      index: true,
    },

    // Title/subject of the feedback
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // Content/description
    content: {
      type: String,
      required: true,
      trim: true,
    },

    // User who submitted the feedback
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },

    // User information (denormalized for quick access)
    user_name: {
      type: String,
      required: true,
    },

    user_email: {
      type: String,
      required: false,
    },

    // Organization this feedback is sent to
    organization_subdomain: {
      type: String,
      required: true,
      index: true,
    },

    // Status: pending, in_progress, resolved, closed
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved", "closed"],
      default: "pending",
      index: true,
    },

    // Priority: low, medium, high, urgent
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Admin response
    response: {
      type: String,
      default: null,
    },

    // Admin who responded
    responded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Response date
    responded_at: {
      type: Date,
      default: null,
    },

    // Attachments (file URLs or paths)
    attachments: [
      {
        url: String,
        filename: String,
        mimetype: String,
        size: Number,
      },
    ],

    // Tags for categorization
    tags: [String],

    // Metadata
    subdomain: {
      type: String,
      required: true,
      index: true,
    },

    database: {
      type: String,
      required: true,
    },

    // Statistics
    views: {
      type: Number,
      default: 0,
    },

    // Soft delete
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Indexes for better query performance
feedbackSchema.index({ organization_subdomain: 1, type: 1, status: 1 });
feedbackSchema.index({ user_id: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, priority: 1, createdAt: -1 });
feedbackSchema.index({ subdomain: 1, is_deleted: 1 });

// Virtual for formatted type name
feedbackSchema.virtual("type_name").get(function () {
  const typeMap = {
    санал: "Suggestion",
    хүсэл: "Request",
    гомдол: "Complaint",
  };
  return typeMap[this.type] || this.type;
});

// Method to mark as resolved
feedbackSchema.methods.markAsResolved = function (adminId, response) {
  this.status = "resolved";
  this.response = response;
  this.responded_by = adminId;
  this.responded_at = new Date();
  return this.save();
};

// Export schema (not model) for multi-tenant support
module.exports = feedbackSchema;
