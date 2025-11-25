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
    if (
      !organization.qpay ||
      !organization.qpay.khariltsagch ||
      !organization.qpay.khariltsagch.merchant_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "QPay merchant not registered for this organization. Please register QPay merchant first.",
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

    // Get callback URL - QPay requires a valid HTTPS URL
    // For sandbox testing, you can use a placeholder HTTPS URL
    // For production, use your actual callback endpoint
    let callbackUrl =
      invoiceData.callback_url ||
      process.env.QPAY_CALLBACK_URL ||
      (process.env.FRONTEND_URL?.startsWith("https")
        ? `${process.env.FRONTEND_URL}/api2/qpay/callback`
        : null);

    // QPay requires a valid, accessible HTTPS callback URL
    // For sandbox testing, you MUST provide a real HTTPS URL
    if (!callbackUrl) {
      return res.status(400).json({
        success: false,
        message: "QPay callback URL is required",
        details: {
          error:
            "QPay API requires a valid HTTPS callback URL that is accessible from the internet",
          solutions: [
            {
              method: "ngrok (Recommended for localhost)",
              steps: [
                "1. Install ngrok: npm install -g ngrok",
                "2. Start ngrok: ngrok http 3001",
                "3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)",
                "4. Set environment variable: QPAY_CALLBACK_URL=https://abc123.ngrok.io/api2/qpay/callback",
              ],
            },
            {
              method: "webhook.site (Quick testing)",
              steps: [
                "1. Go to https://webhook.site",
                "2. Copy your unique URL",
                "3. Set environment variable: QPAY_CALLBACK_URL=<your-webhook-url>",
              ],
            },
            {
              method: "Production",
              steps: [
                "1. Deploy your backend with a public HTTPS URL",
                "2. Set QPAY_CALLBACK_URL=https://your-domain.com/api2/qpay/callback",
              ],
            },
          ],
        },
      });
    }

    // Prepare invoice data for QPay API
    // QPay API expects: merchant_id, amount, currency, description, callback_url
    // Optional: branch_code, customer_name, customer_logo, mcc_code, bank_accounts
    // Note: For QuickQR, bank_accounts is typically not required, but included if provided
    const qpayInvoiceData = {
      merchant_id: merchantId,
      amount: Number(invoiceData.amount), // Ensure it's a number
      currency: invoiceData.currency || "MNT",
      // Description - QPay supports UTF-8, just limit length
      description:
        (
          invoiceData.description ||
          invoiceData.invoice_description ||
          "Invoice payment"
        )
          .trim()
          .substring(0, 255) || "Invoice payment", // Limit to 255 chars
      callback_url: callbackUrl,
      // Optional fields - only include if provided
      ...(invoiceData.branch_code && { branch_code: invoiceData.branch_code }),
      ...(invoiceData.customer_name && {
        customer_name: invoiceData.customer_name,
      }),
      ...(invoiceData.customer_logo && {
        customer_logo: invoiceData.customer_logo,
      }),
      ...(invoiceData.mcc_code && { mcc_code: invoiceData.mcc_code }),
      // Bank accounts - include if provided, otherwise use default from env or organization
      bank_accounts:
        invoiceData.bank_accounts &&
        Array.isArray(invoiceData.bank_accounts) &&
        invoiceData.bank_accounts.length > 0
          ? invoiceData.bank_accounts
          : [
              {
                account_bank_code: process.env.QPAY_BANK_CODE || "040000",
                account_number: process.env.QPAY_ACCOUNT_NUMBER || "5039842709",
                account_name: process.env.QPAY_ACCOUNT_NAME || "Отгонбилэг",
                is_default: true,
              },
            ],
    };

    console.log(
      "📤 Sending invoice data to QPay:",
      JSON.stringify(qpayInvoiceData, null, 2)
    );

    // Generate invoice number before API call
    const senderInvoiceNo =
      invoiceData.sender_invoice_no ||
      `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let qpayResult = null;
    let invoiceDocument = null;

    try {
      // Create invoice via QPay API
      qpayResult = await qpayService.createInvoice(
        centralDb,
        subdomain,
        qpayInvoiceData
      );

      // QPay API returns: id (invoice_id), qr_code, qr_image, invoice_status, etc.
      const qpayInvoiceId = qpayResult.id || qpayResult.invoice_id;
      const invoiceStatus = qpayResult.invoice_status || "OPEN";

      // Map QPay status to our status
      let status = "PENDING";
      if (invoiceStatus === "PAID" || invoiceStatus === "paid") {
        status = "PAID";
      } else if (
        invoiceStatus === "CANCELLED" ||
        invoiceStatus === "cancelled"
      ) {
        status = "CANCELLED";
      } else if (invoiceStatus === "OPEN" || invoiceStatus === "open") {
        status = "PENDING";
      }

      // Save successful invoice to tenant database
      invoiceDocument = {
        invoice_id: qpayInvoiceId,
        qpay_invoice_id: qpayInvoiceId,
        merchant_id: merchantId,
        amount: invoiceData.amount,
        currency: qpayInvoiceData.currency,
        description: qpayInvoiceData.description,
        sender_invoice_no: senderInvoiceNo,
        qr_text: qpayResult.qr_code || qpayResult.qr_text || null, // QR code text
        qr_image: qpayResult.qr_image || null, // QR code image (base64)
        qr_code: qpayResult.qr_code || null, // QR code data
        qpay_url:
          qpayResult.urls?.[0]?.link || qpayResult.urls?.[0]?.name || null, // QPay payment URL
        invoice_status: invoiceStatus, // QPay status (OPEN, PAID, CANCELLED)
        status: status, // Our mapped status
        terminal_id: qpayResult.terminal_id || null,
        legacy_id: qpayResult.legacy_id || null,
        callback_url: qpayInvoiceData.callback_url,
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
    } catch (qpayError) {
      console.error("QPay API error:", {
        message: qpayError.message,
        status: qpayError.response?.status,
        statusText: qpayError.response?.statusText,
        data: qpayError.response?.data,
        config: qpayError.config?.url,
      });

      // Extract error details properly
      const errorCode =
        qpayError.response?.status || qpayError.code || "UNKNOWN";
      let errorDetails = null;

      if (qpayError.response?.data) {
        // Try to parse if it's HTML (404 responses are often HTML)
        if (
          typeof qpayError.response.data === "string" &&
          qpayError.response.data.includes("<html>")
        ) {
          errorDetails = {
            type: "html_response",
            message: "QPay API returned HTML (likely 404 - endpoint not found)",
            hint: "The endpoint /v2/invoice may not exist for QuickQR or your merchant type. Person merchants might need to use a different endpoint or register as company merchant.",
          };
        } else {
          errorDetails = qpayError.response.data;
        }
      } else if (qpayError.response?.statusText) {
        errorDetails = { statusText: qpayError.response.statusText };
      } else {
        errorDetails = { message: qpayError.message };
      }

      // Check merchant type for helpful hint
      const merchantType = organization.qpay?.khariltsagch?.merchant_type;
      if (merchantType === "person" && errorCode === 404) {
        errorDetails.hint =
          errorDetails.hint ||
          "Person merchants might not have access to invoice creation. Try registering as a company merchant instead.";
      }

      // Save failed invoice attempt to database for tracking
      invoiceDocument = {
        invoice_id: null, // No QPay invoice ID since creation failed
        qpay_invoice_id: null,
        merchant_id: merchantId,
        amount: invoiceData.amount,
        currency: qpayInvoiceData.currency,
        description: qpayInvoiceData.description,
        sender_invoice_no: senderInvoiceNo,
        qr_text: null,
        qr_image: null,
        qr_code: null,
        callback_url: qpayInvoiceData.callback_url,
        status: "FAILED", // FAILED status for tracking
        error: {
          message: qpayError.message || "Failed to create invoice",
          code: errorCode,
          status: qpayError.response?.status,
          statusText: qpayError.response?.statusText,
          details: errorDetails,
          url: qpayError.config?.url || null,
        },
        created_by: req.user._id || req.user.id,
        subdomain: subdomain,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save failed invoice to database
      try {
        const invoicesCollection = tenantDb.db.collection("invoices");
        const insertResult = await invoicesCollection.insertOne(
          invoiceDocument
        );
        console.log("✅ Failed invoice saved to database for tracking");
        console.log("📝 Invoice document saved:", {
          _id: insertResult.insertedId.toString(),
          sender_invoice_no: invoiceDocument.sender_invoice_no,
          status: invoiceDocument.status,
          subdomain: invoiceDocument.subdomain,
          merchant_id: invoiceDocument.merchant_id,
        });
        // Add _id to invoice document for response
        invoiceDocument._id = insertResult.insertedId;
      } catch (dbError) {
        console.error("❌ Failed to save invoice to database:", dbError);
        console.error("❌ Database error details:", {
          message: dbError.message,
          code: dbError.code,
          dbName: tenantDb.dbName,
        });
      }

      // Return error response with invoice info
      res.status(500).json({
        success: false,
        message: qpayError.message || "Failed to create invoice",
        error: {
          code: qpayError.response?.status,
          details: qpayError.response?.data,
        },
        invoice: invoiceDocument, // Return the saved invoice document
        invoice_id: invoiceDocument._id?.toString() || null, // MongoDB _id for database queries
        sender_invoice_no: senderInvoiceNo, // Our internal invoice number
        merchant_id: merchantId, // Merchant ID for reference
      });
    }
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
    const tenantDb = req.db;
    const centralDb = req.centralDb;

    // Try to find in local database first (by MongoDB _id or invoice_id)
    const invoicesCollection = tenantDb.db.collection("invoices");

    // Try as MongoDB ObjectId first, then as string
    let invoice = null;
    try {
      const mongoose = require("mongoose");
      const ObjectId = mongoose.Types.ObjectId;
      invoice = await invoicesCollection.findOne({
        $or: [
          { _id: new ObjectId(id) },
          { invoice_id: id },
          { qpay_invoice_id: id },
          { sender_invoice_no: id },
        ],
        subdomain: subdomain,
      });
    } catch (e) {
      // If ObjectId conversion fails, try as string
      invoice = await invoicesCollection.findOne({
        $or: [
          { invoice_id: id },
          { qpay_invoice_id: id },
          { sender_invoice_no: id },
        ],
        subdomain: subdomain,
      });
    }

    if (invoice) {
      return res.json({
        success: true,
        message: "Invoice retrieved from database",
        data: invoice,
      });
    }

    // If not found in database, try to get from QPay API (if it's a QPay invoice_id)
    try {
      const result = await qpayService.getInvoice(centralDb, subdomain, id);
      return res.json({
        success: true,
        message: "Invoice retrieved from QPay API",
        data: result,
      });
    } catch (qpayError) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
        hint: "Invoice not found in database or QPay API. Check the invoice ID.",
      });
    }
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
 * @route   POST /api2/qpay/callback
 * @desc    QPay payment callback webhook (called by QPay when payment is made)
 * @access  Public (QPay calls this endpoint)
 */
router.post("/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    const { invoice_id, payment_status, transaction_id } = callbackData;

    console.log("🔔 QPay callback received:", {
      invoice_id,
      payment_status,
      transaction_id,
      data: callbackData,
    });

    // Find the invoice in tenant database
    // Note: We need to search across all tenant databases or use a central invoice collection
    // For now, we'll log and acknowledge the callback
    // In production, you'd want to:
    // 1. Find the invoice by invoice_id
    // 2. Update the invoice status
    // 3. Trigger any business logic (e.g., activate premium subscription)

    // Acknowledge the callback
    res.status(200).json({
      success: true,
      message: "Callback received",
    });
  } catch (error) {
    console.error("QPay callback error:", error);
    // Still acknowledge to prevent QPay from retrying
    res.status(200).json({
      success: false,
      message: "Callback processed with errors",
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
