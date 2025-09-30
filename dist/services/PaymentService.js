"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const Invoice_1 = require("../models/Invoice");
const Payment_1 = require("../models/Payment");
const AuditLog_1 = require("../models/AuditLog");
class PaymentService {
    async createInvoice(organizationId, invoiceData) {
        const invoiceNumber = await Invoice_1.Invoice.generateInvoiceNumber();
        const invoice = new Invoice_1.Invoice({
            ...invoiceData,
            organizationId,
            invoiceNumber,
        });
        await invoice.save();
        // Log invoice creation
        await AuditLog_1.AuditLog.logAction({
            organizationId,
            action: "invoice_created",
            resource: "invoice",
            resourceId: invoice._id,
        });
        return invoice;
    }
    async getInvoices(organizationId, page = 1, limit = 20, status) {
        const result = await Invoice_1.Invoice.getByOrganization(organizationId, status, page, limit);
        return {
            data: result.invoices,
            pagination: result.pagination,
        };
    }
    async getInvoiceById(invoiceId, organizationId) {
        const invoice = await Invoice_1.Invoice.findOne({ _id: invoiceId, organizationId });
        if (!invoice) {
            throw new Error("Invoice not found");
        }
        return invoice;
    }
    async updateInvoice(invoiceId, updateData, organizationId) {
        const invoice = await this.getInvoiceById(invoiceId, organizationId);
        Object.assign(invoice, updateData);
        await invoice.save();
        // Log invoice update
        await AuditLog_1.AuditLog.logAction({
            organizationId,
            action: "invoice_updated",
            resource: "invoice",
            resourceId: invoiceId,
        });
        return invoice;
    }
    async deleteInvoice(invoiceId, organizationId) {
        const invoice = await this.getInvoiceById(invoiceId, organizationId);
        // Check if invoice has payments
        const payments = await Payment_1.Payment.getByInvoice(invoiceId);
        if (payments.length > 0) {
            throw new Error("Cannot delete invoice with existing payments");
        }
        await Invoice_1.Invoice.findByIdAndDelete(invoiceId);
        // Log invoice deletion
        await AuditLog_1.AuditLog.logAction({
            organizationId,
            action: "invoice_deleted",
            resource: "invoice",
            resourceId: invoiceId,
        });
    }
    async processPayment(invoiceId, paymentData, organizationId) {
        const invoice = await this.getInvoiceById(invoiceId, organizationId);
        if (invoice.status === "paid") {
            throw new Error("Invoice is already paid");
        }
        if (invoice.status === "cancelled") {
            throw new Error("Cannot process payment for cancelled invoice");
        }
        const payment = new Payment_1.Payment({
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
        await AuditLog_1.AuditLog.logAction({
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
    async getPayments(organizationId, page = 1, limit = 20) {
        const result = await Payment_1.Payment.getByOrganization(organizationId, page, limit);
        return {
            data: result.payments,
            pagination: result.pagination,
        };
    }
    async getPaymentById(paymentId, organizationId) {
        const payment = await Payment_1.Payment.findById(paymentId).populate("invoiceId");
        if (!payment ||
            payment.invoiceId.organizationId.toString() !== organizationId) {
            throw new Error("Payment not found");
        }
        return payment;
    }
    async getPaymentStats(organizationId, startDate, endDate) {
        return Payment_1.Payment.getPaymentStats(organizationId, startDate, endDate);
    }
    async refundPayment(paymentId, organizationId) {
        const payment = await this.getPaymentById(paymentId, organizationId);
        if (payment.status !== "completed") {
            throw new Error("Only completed payments can be refunded");
        }
        await payment.refund();
        // Log payment refund
        await AuditLog_1.AuditLog.logAction({
            organizationId,
            action: "payment_refunded",
            resource: "payment",
            resourceId: paymentId,
        });
        return payment;
    }
    async getOverdueInvoices(organizationId) {
        const overdueInvoices = await Invoice_1.Invoice.getOverdueInvoices();
        return overdueInvoices.filter((invoice) => invoice.organizationId.toString() === organizationId);
    }
    async cancelInvoice(invoiceId, organizationId) {
        const invoice = await this.getInvoiceById(invoiceId, organizationId);
        if (invoice.status === "paid") {
            throw new Error("Cannot cancel paid invoice");
        }
        await invoice.cancel();
        // Log invoice cancellation
        await AuditLog_1.AuditLog.logAction({
            organizationId,
            action: "invoice_cancelled",
            resource: "invoice",
            resourceId: invoiceId,
        });
        return invoice;
    }
}
exports.PaymentService = PaymentService;
