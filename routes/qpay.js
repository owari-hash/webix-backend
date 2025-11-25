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
    const tenantDb = req.db;

    // Get organization QPay settings to get merchant_id
    const organizationCollection = centralDb.collection("Organization");
    const organization = await organizationCollection.findOne({ subdomain });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if QPay is registered
    if (!organization.qpay || !organization.qpay.khariltsagch || !organization.qpay.khariltsagch.merchant_id) {
      return res.status(400).json({
        success: false,
        message: "QPay merchant not registered for this organization. Please register QPay merchant first.",
      });
    }

    const merchantId = organization.qpay.khariltsagch.merchant_id;

    // Validate required fields (merchant_id will be added automatically)
    const required = ["amount", "currency"];
    const missing = required.filter((field) => !invoiceData[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Prepare invoice data for QPay API
    const qpayInvoiceData = {
      merchant_id: merchantId,
      amount: invoiceData.amount,
      currency: invoiceData.currency || "MNT",
      invoice_description: invoiceData.description || invoiceData.invoice_description || "Invoice payment",
      invoice_receiver_code: invoiceData.invoice_receiver_code || "",
      callback_url: invoiceData.callback_url || `${process.env.FRONTEND_URL || "http://localhost:8002"}/payment/callback`,
      sender_invoice_no: invoiceData.sender_invoice_no || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Create invoice via QPay API
    const qpayResult = await qpayService.createInvoice(
      centralDb,
      subdomain,
      qpayInvoiceData
    );

    // Save invoice to tenant database
    const invoiceDocument = {
      invoice_id: qpayResult.invoice_id,
      qpay_invoice_id: qpayResult.invoice_id,
      merchant_id: merchantId,
      amount: invoiceData.amount,
      currency: qpayInvoiceData.currency,
      description: qpayInvoiceData.invoice_description,
      sender_invoice_no: qpayInvoiceData.sender_invoice_no,
      qr_text: qpayResult.qr_text || null,
      qr_image: qpayResult.qr_image || null,
      qr_code: qpayResult.qr_code || null,
      callback_url: qpayInvoiceData.callback_url,
      status: "PENDING", // PENDING, PAID, CANCELLED
      created_by: req.user._id || req.user.id,
      subdomain: subdomain,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to invoices collection in tenant database
    const invoicesCollection = tenantDb.db.collection("invoices");
    await invoicesCollection.insertOne(invoiceDocument);

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: {
        ...qpayResult,
        invoice: invoiceDocument,
      },
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
    const tenantDb = req.db;

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Check payment status via QPay API
    const result = await qpayService.checkPayment(
      centralDb,
      subdomain,
      invoice_id
    );

    // Update invoice status in database
    const invoicesCollection = tenantDb.db.collection("invoices");
    const paymentStatus = result.payment_status || result.status;
    
    let status = "PENDING";
    if (paymentStatus === "PAID" || paymentStatus === "paid") {
      status = "PAID";
    } else if (paymentStatus === "CANCELLED" || paymentStatus === "cancelled") {
      status = "CANCELLED";
    }

    await invoicesCollection.updateOne(
      { invoice_id: invoice_id },
      {
        $set: {
          status: status,
          payment_status: paymentStatus,
          payment_data: result,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: "Payment status retrieved successfully",
      data: {
        ...result,
        status: status,
      },
    });
  } catch (error) {
    console.error("Check payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check payment status",
    });
  }
});

/**
 * @route   GET /api2/qpay/invoices
 * @desc    Get all invoices for organization
 * @access  Private (Authenticated users)
 */
router.get("/invoices", authenticate, async (req, res) => {
  try {
    const tenantDb = req.db;
    const { status, limit = 50, skip = 0 } = req.query;

    const invoicesCollection = tenantDb.db.collection("invoices");
    
    let query = {};
    if (status) {
      query.status = status.toUpperCase();
    }

    const invoices = await invoicesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();

    const total = await invoicesCollection.countDocuments(query);

    res.json({
      success: true,
      message: "Invoices retrieved successfully",
      data: {
        invoices,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get invoices",
    });
  }
});

module.exports = router;
