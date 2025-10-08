import { Invoice } from "../models/Invoice";
import { Payment } from "../models/Payment";
import { AuditLog } from "../models/AuditLog";
import { CreateInvoiceDto, PaymentDto, PaginatedResponse } from "../types";
import mongoose from "mongoose";

export class PaymentService {
  async createInvoice(
    organizationId: string,
    invoiceData: CreateInvoiceDto
  ): Promise<any> {
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const invoice = new Invoice({
      ...invoiceData,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      invoiceNumber,
    });

    await invoice.save();

    // Log invoice creation
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      action: "invoice_created",
      resource: "invoice",
      resourceId: invoice._id,
    });
    await auditLog.save();

    return invoice;
  }

  async getInvoices(
    organizationId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    const query: any = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    if (status) {
      query.status = status;
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Invoice.countDocuments(query),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoiceById(
    invoiceId: string,
    organizationId: string
  ): Promise<any> {
    const invoice = await Invoice.findOne({
      _id: new mongoose.Types.ObjectId(invoiceId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice;
  }

  async updateInvoice(
    invoiceId: string,
    updateData: Partial<CreateInvoiceDto>,
    organizationId: string
  ): Promise<any> {
    const invoice = await this.getInvoiceById(invoiceId, organizationId);

    Object.assign(invoice, updateData);
    await invoice.save();

    // Log invoice update
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      action: "invoice_updated",
      resource: "invoice",
      resourceId: new mongoose.Types.ObjectId(invoiceId),
    });
    await auditLog.save();

    return invoice;
  }

  async deleteInvoice(
    invoiceId: string,
    organizationId: string
  ): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId, organizationId);

    // Check if invoice has payments
    const payments = await Payment.find({
      invoiceId: new mongoose.Types.ObjectId(invoiceId),
    });
    if (payments.length > 0) {
      throw new Error("Cannot delete invoice with existing payments");
    }

    await Invoice.findByIdAndDelete(new mongoose.Types.ObjectId(invoiceId));

    // Log invoice deletion
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      action: "invoice_deleted",
      resource: "invoice",
      resourceId: new mongoose.Types.ObjectId(invoiceId),
    });
    await auditLog.save();
  }

  async processPayment(
    invoiceId: string,
    paymentData: PaymentDto,
    organizationId: string
  ): Promise<any> {
    const invoice = await this.getInvoiceById(invoiceId, organizationId);

    if (invoice.status === "paid") {
      throw new Error("Invoice is already paid");
    }

    if (invoice.status === "cancelled") {
      throw new Error("Cannot process payment for cancelled invoice");
    }

    const payment = new Payment({
      invoiceId: new mongoose.Types.ObjectId(invoiceId),
      amount: paymentData.amount,
      method: paymentData.method,
      transactionId: paymentData.transactionId,
      status: "pending",
    });

    await payment.save();

    // Mark payment as completed
    payment.status = "completed";
    await payment.save();

    // Mark invoice as paid
    invoice.status = "paid";
    invoice.paidAt = new Date();
    await invoice.save();

    // Log payment processing
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      action: "payment_processed",
      resource: "payment",
      resourceId: payment._id,
      metadata: {
        invoiceId,
        amount: paymentData.amount,
        method: paymentData.method,
      },
    });
    await auditLog.save();

    return payment;
  }

  async getPayments(
    organizationId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({
        organizationId: new mongoose.Types.ObjectId(organizationId),
      })
        .populate("invoiceId")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Payment.countDocuments({
        organizationId: new mongoose.Types.ObjectId(organizationId),
      }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentById(
    paymentId: string,
    organizationId: string
  ): Promise<any> {
    const payment = await Payment.findById(
      new mongoose.Types.ObjectId(paymentId)
    ).populate("invoiceId");

    if (
      !payment ||
      (payment.invoiceId as any).organizationId.toString() !== organizationId
    ) {
      throw new Error("Payment not found");
    }

    return payment;
  }

  async getPaymentStats(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const pipeline: any[] = [
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
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
        },
      },
    ];

    const result = await Payment.aggregate(pipeline);
    return (
      result[0] || {
        totalAmount: 0,
        totalPayments: 0,
        completedPayments: 0,
        pendingPayments: 0,
      }
    );
  }

  async refundPayment(paymentId: string, organizationId: string): Promise<any> {
    const payment = await this.getPaymentById(paymentId, organizationId);

    if (payment.status !== "completed") {
      throw new Error("Only completed payments can be refunded");
    }

    payment.status = "refunded";
    payment.refundedAt = new Date();
    await payment.save();

    // Log payment refund
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      action: "payment_refunded",
      resource: "payment",
      resourceId: new mongoose.Types.ObjectId(paymentId),
    });
    await auditLog.save();

    return payment;
  }

  async getOverdueInvoices(organizationId: string): Promise<any[]> {
    const overdueInvoices = await Invoice.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: { $in: ["pending", "overdue"] },
      dueDate: { $lt: new Date() },
    });

    return overdueInvoices;
  }

  async cancelInvoice(invoiceId: string, organizationId: string): Promise<any> {
    const invoice = await this.getInvoiceById(invoiceId, organizationId);

    if (invoice.status === "paid") {
      throw new Error("Cannot cancel paid invoice");
    }

    invoice.status = "cancelled";
    invoice.cancelledAt = new Date();
    await invoice.save();

    // Log invoice cancellation
    const auditLog = new AuditLog({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      action: "invoice_cancelled",
      resource: "invoice",
      resourceId: new mongoose.Types.ObjectId(invoiceId),
    });
    await auditLog.save();

    return invoice;
  }
}
