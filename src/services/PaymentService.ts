import { Invoice } from "../models/Invoice";
import { Payment } from "../models/Payment";
import { AuditLog } from "../models/AuditLog";
import { CreateInvoiceDto, PaymentDto, PaginatedResponse } from "../types";

export class PaymentService {
  async createInvoice(
    organizationId: string,
    invoiceData: CreateInvoiceDto
  ): Promise<any> {
    const invoiceNumber = await Invoice.generateInvoiceNumber();

    const invoice = new Invoice({
      ...invoiceData,
      organizationId,
      invoiceNumber,
    });

    await invoice.save();

    // Log invoice creation
    await AuditLog.logAction({
      organizationId,
      action: "invoice_created",
      resource: "invoice",
      resourceId: invoice._id,
    });

    return invoice;
  }

  async getInvoices(
    organizationId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<PaginatedResponse<any>> {
    const result = await Invoice.getByOrganization(
      organizationId,
      status,
      page,
      limit
    );

    return {
      data: result.invoices,
      pagination: result.pagination,
    };
  }

  async getInvoiceById(
    invoiceId: string,
    organizationId: string
  ): Promise<any> {
    const invoice = await Invoice.findOne({ _id: invoiceId, organizationId });
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
    await AuditLog.logAction({
      organizationId,
      action: "invoice_updated",
      resource: "invoice",
      resourceId: invoiceId,
    });

    return invoice;
  }

  async deleteInvoice(
    invoiceId: string,
    organizationId: string
  ): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId, organizationId);

    // Check if invoice has payments
    const payments = await Payment.getByInvoice(invoiceId);
    if (payments.length > 0) {
      throw new Error("Cannot delete invoice with existing payments");
    }

    await Invoice.findByIdAndDelete(invoiceId);

    // Log invoice deletion
    await AuditLog.logAction({
      organizationId,
      action: "invoice_deleted",
      resource: "invoice",
      resourceId: invoiceId,
    });
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
      invoiceId,
      amount: paymentData.amount,
      method: paymentData.method,
      transactionId: paymentData.transactionId,
      status: "pending",
    });

    await payment.save();

    // Mark payment as completed (in real implementation, this would be done after payment verification)
    await payment.markAsCompleted(paymentData.transactionId);

    // Mark invoice as paid
    await invoice.markAsPaid();

    // Log payment processing
    await AuditLog.logAction({
      organizationId,
      action: "payment_processed",
      resource: "payment",
      resourceId: payment._id,
      metadata: {
        invoiceId,
        amount: paymentData.amount,
        method: paymentData.method,
      },
    });

    return payment;
  }

  async getPayments(
    organizationId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<any>> {
    const result = await Payment.getByOrganization(organizationId, page, limit);

    return {
      data: result.payments,
      pagination: result.pagination,
    };
  }

  async getPaymentById(
    paymentId: string,
    organizationId: string
  ): Promise<any> {
    const payment = await Payment.findById(paymentId).populate("invoiceId");

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
    return Payment.getPaymentStats(organizationId, startDate, endDate);
  }

  async refundPayment(paymentId: string, organizationId: string): Promise<any> {
    const payment = await this.getPaymentById(paymentId, organizationId);

    if (payment.status !== "completed") {
      throw new Error("Only completed payments can be refunded");
    }

    await payment.refund();

    // Log payment refund
    await AuditLog.logAction({
      organizationId,
      action: "payment_refunded",
      resource: "payment",
      resourceId: paymentId,
    });

    return payment;
  }

  async getOverdueInvoices(organizationId: string): Promise<any[]> {
    const overdueInvoices = await Invoice.getOverdueInvoices();
    return overdueInvoices.filter(
      (invoice) => (invoice.organizationId as any).toString() === organizationId
    );
  }

  async cancelInvoice(invoiceId: string, organizationId: string): Promise<any> {
    const invoice = await this.getInvoiceById(invoiceId, organizationId);

    if (invoice.status === "paid") {
      throw new Error("Cannot cancel paid invoice");
    }

    await invoice.cancel();

    // Log invoice cancellation
    await AuditLog.logAction({
      organizationId,
      action: "invoice_cancelled",
      resource: "invoice",
      resourceId: invoiceId,
    });

    return invoice;
  }
}
