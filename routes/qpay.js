const express = require("express");
const qpayService = require("../services/qpay");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ==================== INVOICE ENDPOINTS ====================

/**
 * @route   POST /api2/qpay/invoice
 * @desc    Create invoice for organization
 * @access  Private (Authenticated users)
 */
router.post("/invoice", authenticate, async (req, res) => {
  try {
    const invoiceData = req.body;
    const subdomain = req.subdomain;
    const centralDb = req.centralDb;

    // Validate required fields
    const required = ["merchant_id", "amount", "currency", "callback_url"];
    const missing = required.filter((field) => !invoiceData[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const result = await qpayService.createInvoice(
      centralDb,
      subdomain,
      invoiceData
    );

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create invoice",
    });
  }
});

/**
 * @route   GET /api2/qpay/invoice/:id
 * @desc    Get invoice by ID for organization
 * @access  Private (Authenticated users)
 */
router.get("/invoice/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const subdomain = req.subdomain;
    const centralDb = req.centralDb;

    const result = await qpayService.getInvoice(centralDb, subdomain, id);

    res.json({
      success: true,
      message: "Invoice retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get invoice",
    });
  }
});

/**
 * @route   DELETE /api2/qpay/invoice/:id
 * @desc    Cancel invoice for organization
 * @access  Private (Authenticated users)
 */
router.delete("/invoice/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const subdomain = req.subdomain;
    const centralDb = req.centralDb;

    const result = await qpayService.cancelInvoice(centralDb, subdomain, id);

    res.json({
      success: true,
      message: "Invoice cancelled successfully",
      data: result,
    });
  } catch (error) {
    console.error("Cancel invoice error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel invoice",
    });
  }
});

// ==================== PAYMENT ENDPOINTS ====================

/**
 * @route   POST /api2/qpay/payment/check
 * @desc    Check payment status for organization
 * @access  Private (Authenticated users)
 */
router.post("/payment/check", authenticate, async (req, res) => {
  try {
    const { invoice_id } = req.body;
    const subdomain = req.subdomain;
    const centralDb = req.centralDb;

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const result = await qpayService.checkPayment(
      centralDb,
      subdomain,
      invoice_id
    );

    res.json({
      success: true,
      message: "Payment status retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Check payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check payment status",
    });
  }
});

module.exports = router;
