"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PaymentService_1 = require("../services/PaymentService");
const middleware_1 = require("../middleware");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const paymentService = new PaymentService_1.PaymentService();
// Create invoice
router.post("/:organizationId/invoices", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:write"]), (0, middleware_1.validateRequest)(validation_1.createInvoiceSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const invoice = await paymentService.createInvoice(req.params.organizationId, req.body);
    res.status(201).json({
        success: true,
        message: "Invoice created successfully",
        data: invoice,
    });
}));
// Get invoices
router.get("/:organizationId/invoices", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const result = await paymentService.getInvoices(req.params.organizationId, Number(page), Number(limit), status);
    res.json({
        success: true,
        data: result,
    });
}));
// Get invoice by ID
router.get("/:organizationId/invoices/:invoiceId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const invoice = await paymentService.getInvoiceById(req.params.invoiceId, req.params.organizationId);
    res.json({
        success: true,
        data: invoice,
    });
}));
// Update invoice
router.put("/:organizationId/invoices/:invoiceId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:write"]), (0, middleware_1.validateRequest)(validation_1.createInvoiceSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const invoice = await paymentService.updateInvoice(req.params.invoiceId, req.body, req.params.organizationId);
    res.json({
        success: true,
        message: "Invoice updated successfully",
        data: invoice,
    });
}));
// Delete invoice
router.delete("/:organizationId/invoices/:invoiceId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await paymentService.deleteInvoice(req.params.invoiceId, req.params.organizationId);
    res.json({
        success: true,
        message: "Invoice deleted successfully",
    });
}));
// Cancel invoice
router.post("/:organizationId/invoices/:invoiceId/cancel", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const invoice = await paymentService.cancelInvoice(req.params.invoiceId, req.params.organizationId);
    res.json({
        success: true,
        message: "Invoice cancelled successfully",
        data: invoice,
    });
}));
// Process payment
router.post("/:organizationId/invoices/:invoiceId/payments", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:write"]), (0, middleware_1.validateRequest)(validation_1.createPaymentSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payment = await paymentService.processPayment(req.params.invoiceId, req.body, req.params.organizationId);
    res.status(201).json({
        success: true,
        message: "Payment processed successfully",
        data: payment,
    });
}));
// Get payments
router.get("/:organizationId/payments", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await paymentService.getPayments(req.params.organizationId, Number(page), Number(limit));
    res.json({
        success: true,
        data: result,
    });
}));
// Get payment by ID
router.get("/:organizationId/payments/:paymentId", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payment = await paymentService.getPaymentById(req.params.paymentId, req.params.organizationId);
    res.json({
        success: true,
        data: payment,
    });
}));
// Refund payment
router.post("/:organizationId/payments/:paymentId/refund", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:write"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payment = await paymentService.refundPayment(req.params.paymentId, req.params.organizationId);
    res.json({
        success: true,
        message: "Payment refunded successfully",
        data: payment,
    });
}));
// Get payment statistics
router.get("/:organizationId/stats", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const stats = await paymentService.getPaymentStats(req.params.organizationId, start, end);
    res.json({
        success: true,
        data: stats,
    });
}));
// Get overdue invoices
router.get("/:organizationId/overdue", middleware_1.authMiddleware, middleware_1.organizationAccessMiddleware, (0, middleware_1.permissionMiddleware)(["payments:read"]), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const overdueInvoices = await paymentService.getOverdueInvoices(req.params.organizationId);
    res.json({
        success: true,
        data: overdueInvoices,
    });
}));
exports.default = router;
