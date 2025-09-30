import express from "express";
import { PaymentService } from "../services/PaymentService";
import {
  authMiddleware,
  organizationAccessMiddleware,
  validateRequest,
  permissionMiddleware,
} from "../middleware";
import {
  createInvoiceSchema,
  createPaymentSchema,
} from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const paymentService = new PaymentService();

// Create invoice
router.post(
  "/:organizationId/invoices",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:write"]),
  validateRequest(createInvoiceSchema),
  asyncHandler(async (req, res) => {
    const invoice = await paymentService.createInvoice(
      req.params.organizationId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  })
);

// Get invoices
router.get(
  "/:organizationId/invoices",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:read"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const result = await paymentService.getInvoices(
      req.params.organizationId,
      Number(page),
      Number(limit),
      status as string
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get invoice by ID
router.get(
  "/:organizationId/invoices/:invoiceId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:read"]),
  asyncHandler(async (req, res) => {
    const invoice = await paymentService.getInvoiceById(
      req.params.invoiceId,
      req.params.organizationId
    );

    res.json({
      success: true,
      data: invoice,
    });
  })
);

// Update invoice
router.put(
  "/:organizationId/invoices/:invoiceId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:write"]),
  validateRequest(createInvoiceSchema),
  asyncHandler(async (req, res) => {
    const invoice = await paymentService.updateInvoice(
      req.params.invoiceId,
      req.body,
      req.params.organizationId
    );

    res.json({
      success: true,
      message: "Invoice updated successfully",
      data: invoice,
    });
  })
);

// Delete invoice
router.delete(
  "/:organizationId/invoices/:invoiceId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:write"]),
  asyncHandler(async (req, res) => {
    await paymentService.deleteInvoice(
      req.params.invoiceId,
      req.params.organizationId
    );

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  })
);

// Cancel invoice
router.post(
  "/:organizationId/invoices/:invoiceId/cancel",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:write"]),
  asyncHandler(async (req, res) => {
    const invoice = await paymentService.cancelInvoice(
      req.params.invoiceId,
      req.params.organizationId
    );

    res.json({
      success: true,
      message: "Invoice cancelled successfully",
      data: invoice,
    });
  })
);

// Process payment
router.post(
  "/:organizationId/invoices/:invoiceId/payments",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:write"]),
  validateRequest(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const payment = await paymentService.processPayment(
      req.params.invoiceId,
      req.body,
      req.params.organizationId
    );

    res.status(201).json({
      success: true,
      message: "Payment processed successfully",
      data: payment,
    });
  })
);

// Get payments
router.get(
  "/:organizationId/payments",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:read"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const result = await paymentService.getPayments(
      req.params.organizationId,
      Number(page),
      Number(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get payment by ID
router.get(
  "/:organizationId/payments/:paymentId",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:read"]),
  asyncHandler(async (req, res) => {
    const payment = await paymentService.getPaymentById(
      req.params.paymentId,
      req.params.organizationId
    );

    res.json({
      success: true,
      data: payment,
    });
  })
);

// Refund payment
router.post(
  "/:organizationId/payments/:paymentId/refund",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:write"]),
  asyncHandler(async (req, res) => {
    const payment = await paymentService.refundPayment(
      req.params.paymentId,
      req.params.organizationId
    );

    res.json({
      success: true,
      message: "Payment refunded successfully",
      data: payment,
    });
  })
);

// Get payment statistics
router.get(
  "/:organizationId/stats",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:read"]),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const stats = await paymentService.getPaymentStats(
      req.params.organizationId,
      start,
      end
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

// Get overdue invoices
router.get(
  "/:organizationId/overdue",
  authMiddleware,
  organizationAccessMiddleware,
  permissionMiddleware(["payments:read"]),
  asyncHandler(async (req, res) => {
    const overdueInvoices = await paymentService.getOverdueInvoices(
      req.params.organizationId
    );

    res.json({
      success: true,
      data: overdueInvoices,
    });
  })
);

export default router;
