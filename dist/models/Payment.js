"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const PaymentSchema = new mongoose_1.Schema({
    invoiceId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
// Indexes
PaymentSchema.index({ invoiceId: 1, status: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ createdAt: -1 });
// Pre-save middleware to set processedAt
PaymentSchema.pre("save", function (next) {
    if (this.isModified("status") &&
        this.status === "completed" &&
        !this.processedAt) {
        this.processedAt = new Date();
    }
    next();
});
// Static method to get payments by invoice
PaymentSchema.statics.getByInvoice = async function (invoiceId) {
    return this.find({ invoiceId }).sort({ createdAt: -1 });
};
// Static method to get payments by organization
PaymentSchema.statics.getByOrganization = async function (organizationId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const payments = await this.find()
        .populate({
        path: "invoiceId",
        match: { organizationId: new mongoose_1.default.Types.ObjectId(organizationId) },
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
PaymentSchema.statics.getPaymentStats = async function (organizationId, startDate, endDate) {
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
                "invoice.organizationId": new mongoose_1.default.Types.ObjectId(organizationId),
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
    return (result[0] || {
        totalAmount: 0,
        totalPayments: 0,
        completedPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        averageAmount: 0,
    });
};
// Instance method to mark as completed
PaymentSchema.methods.markAsCompleted = function (transactionId) {
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
exports.Payment = mongoose_1.default.model("payment", PaymentSchema);
