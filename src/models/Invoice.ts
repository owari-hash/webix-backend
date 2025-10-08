import mongoose, { Schema, Document } from "mongoose";

mongoose.pluralize(null);

export interface InvoiceDocument extends Document {
  organizationId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: Date;
  paidAt?: Date;
  description?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<InvoiceDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Indexes
InvoiceSchema.index({ organizationId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1 });
InvoiceSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate total amount

// Pre-save middleware to calculate invoice total
InvoiceSchema.pre("save", function (next) {
  if (this.isModified("items")) {
    this.amount = this.items.reduce((total, item) => total + item.total, 0);
  }
  next();
});

// Static method to generate invoice number
InvoiceSchema.statics.generateInvoiceNumber =
  async function (): Promise<string> {
    const count = await this.countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const sequence = String(count + 1).padStart(6, "0");
    return `INV-${year}${month}-${sequence}`;
  };

// Static method to get organization invoices
InvoiceSchema.statics.getByOrganization = async function (
  organizationId: string,
  status?: string,
  page = 1,
  limit = 20
) {
  const query: any = { organizationId };
  if (status) query.status = status;

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

export const Invoice = mongoose.model<InvoiceDocument>(
  "invoice",
  InvoiceSchema
);
