import mongoose, { Schema, Document } from "mongoose";
import { Payment as IPayment } from "../types";

mongoose.pluralize(null);

export interface PaymentDocument extends IPayment, Document {}

const PaymentSchema = new Schema<PaymentDocument>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "invoice",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "MNT",
      index: true,
    },
    method: {
      type: String,
      enum: ["card", "bank_transfer", "mobile_payment", "cash"],
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({ invoiceId: 1, status: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ createdAt: -1 });

// Pre-save middleware to set processedAt
PaymentSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.processedAt
  ) {
    this.processedAt = new Date();
  }
  next();
});

// Static method to get payments by invoice
PaymentSchema.statics.getByInvoice = async function (invoiceId: string) {
  return this.find({ invoiceId }).sort({ createdAt: -1 });
};

// Static method to get payments by organization
PaymentSchema.statics.getByOrganization = async function (
  organizationId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;

  const payments = await this.find()
    .populate({
      path: "invoiceId",
      match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Filter out payments where invoice is null (due to match condition)
  const filteredPayments = payments.filter((payment) => payment.invoiceId);

  const total = await this.countDocuments({
    invoiceId: { $exists: true },
  });

  return {
    payments: filteredPayments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get payment statistics
PaymentSchema.statics.getPaymentStats = async function (
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $lookup: {
        from: "invoices",
        localField: "invoiceId",
        foreignField: "_id",
        as: "invoice",
      },
    },
    {
      $unwind: "$invoice",
    },
    {
      $match: {
        "invoice.organizationId": new mongoose.Types.ObjectId(organizationId),
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        averageAmount: { $avg: "$amount" },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  return (
    result[0] || {
      totalAmount: 0,
      totalPayments: 0,
      completedPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
      averageAmount: 0,
    }
  );
};

// Instance method to mark as completed
PaymentSchema.methods.markAsCompleted = function (transactionId?: string) {
  this.status = "completed";
  this.processedAt = new Date();
  if (transactionId) {
    this.transactionId = transactionId;
  }
  return this.save();
};

// Instance method to mark as failed
PaymentSchema.methods.markAsFailed = function () {
  this.status = "failed";
  return this.save();
};

// Instance method to refund
PaymentSchema.methods.refund = function () {
  this.status = "refunded";
  return this.save();
};

export const Payment = mongoose.model<PaymentDocument>(
  "payment",
  PaymentSchema
);
