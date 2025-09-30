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
exports.Invoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
mongoose_1.default.pluralize(null);
const InvoiceItemSchema = new mongoose_1.Schema({
    description: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    total: {
        type: Number,
        required: true,
        min: 0,
    },
});
const InvoiceSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "organization",
        required: true,
        index: true,
    },
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
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
    status: {
        type: String,
        enum: ["draft", "sent", "paid", "overdue", "cancelled"],
        default: "draft",
        index: true,
    },
    dueDate: {
        type: Date,
        required: true,
        index: true,
    },
    paidAt: {
        type: Date,
    },
    items: [InvoiceItemSchema],
}, {
    timestamps: true,
});
// Indexes
InvoiceSchema.index({ organizationId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1 });
InvoiceSchema.index({ createdAt: -1 });
// Pre-save middleware to calculate total amount
InvoiceItemSchema.pre("save", function (next) {
    this.total = this.quantity * this.unitPrice;
    next();
});
// Pre-save middleware to calculate invoice total
InvoiceSchema.pre("save", function (next) {
    if (this.isModified("items")) {
        this.amount = this.items.reduce((total, item) => total + item.total, 0);
    }
    next();
});
// Static method to generate invoice number
InvoiceSchema.statics.generateInvoiceNumber =
    async function () {
        const count = await this.countDocuments();
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, "0");
        const sequence = String(count + 1).padStart(6, "0");
        return `INV-${year}${month}-${sequence}`;
    };
// Static method to get organization invoices
InvoiceSchema.statics.getByOrganization = async function (organizationId, status, page = 1, limit = 20) {
    const query = { organizationId };
    if (status)
        query.status = status;
    const skip = (page - 1) * limit;
    const invoices = await this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await this.countDocuments(query);
    return {
        invoices,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};
// Static method to get overdue invoices
InvoiceSchema.statics.getOverdueInvoices = async function () {
    const today = new Date();
    return this.find({
        status: { $in: ["sent", "draft"] },
        dueDate: { $lt: today },
    }).populate("organizationId", "name subdomain");
};
// Instance method to mark as paid
InvoiceSchema.methods.markAsPaid = function () {
    this.status = "paid";
    this.paidAt = new Date();
    return this.save();
};
// Instance method to cancel invoice
InvoiceSchema.methods.cancel = function () {
    this.status = "cancelled";
    return this.save();
};
exports.Invoice = mongoose_1.default.model("invoice", InvoiceSchema);
