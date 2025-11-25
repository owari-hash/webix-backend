const axios = require("axios");

/**
 * Qpay API Service
 * Handles all communication with Qpay Quick Pay API
 * Organization-specific implementation
 */
class QpayService {
  constructor() {
    // Default base URL (can be overridden per organization)
    this.baseURL =
      process.env.QPAY_BASE_URL || "https://sandbox-quickqr.qpay.mn";
    // Token cache per organization: { subdomain: { token, expiry } }
    this.tokenCache = {};
  }

  /**
   * Get organization Qpay settings from database
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @returns {Promise<Object>} Qpay settings
   */
  async getOrganizationSettings(centralDb, subdomain) {
    try {
      const organizationCollection = centralDb.collection("Organization");
      const organization = await organizationCollection.findOne({ subdomain });

      if (!organization) {
        throw new Error(`Organization not found for subdomain: ${subdomain}`);
      }

      // Get Qpay settings from organization.qpay (not organization.settings.qpay)
      const qpay = organization.qpay || {};

      // Check if QPay merchant is registered
      if (!qpay.khariltsagch || !qpay.khariltsagch.merchant_id) {
        throw new Error(
          `QPay merchant not registered for organization: ${subdomain}. Please register QPay merchant first.`
        );
      }

      // Get terminal_id from credentials
      const terminalId = qpay.credentials?.terminal_id;

      if (!terminalId) {
        throw new Error(
          `QPay terminal_id not configured for organization: ${subdomain}. Please set QPay settings first.`
        );
      }

      // Use global QPay credentials from env (as per webix-udirdlaga-back implementation)
      const username = process.env.QPAY_USERNAME;
      const password = process.env.QPAY_PASSWORD;

      if (!username || !password) {
        throw new Error(
          `QPay credentials not configured. Set QPAY_USERNAME and QPAY_PASSWORD in environment variables.`
        );
      }

      return {
        baseURL: process.env.QPAY_BASE_URL || this.baseURL,
        username,
        password,
        terminalId,
        merchantId: qpay.khariltsagch.merchant_id,
        // Include stored token if available
        storedToken: qpay.token,
      };
    } catch (error) {
      console.error("Get organization Qpay settings error:", error);
      throw error;
    }
  }

  /**
   * Get access token from Qpay API for specific organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @returns {Promise<Object>} Token response
   */
  async getToken(centralDb, subdomain) {
    try {
      console.log(`🔑 Getting QPay token for subdomain: ${subdomain}`);

      // Check cache first
      const cached = this.tokenCache[subdomain];
      if (cached && cached.expiry && Date.now() < cached.expiry) {
        console.log(
          `✅ Using cached token (expires in ${Math.floor(
            (cached.expiry - Date.now()) / 1000
          )}s)`
        );
        return {
          access_token: cached.token,
          token: cached.token,
          expires_in: Math.floor((cached.expiry - Date.now()) / 1000),
        };
      }

      // Get organization settings (includes stored token)
      const settings = await this.getOrganizationSettings(centralDb, subdomain);
      console.log(
        `📋 Organization settings retrieved. Terminal ID: ${settings.terminalId}, Merchant ID: ${settings.merchantId}`
      );

      // Check if stored token is still valid
      if (settings.storedToken && settings.storedToken.access_token) {
        const expiresAt = settings.storedToken.expires_at
          ? new Date(settings.storedToken.expires_at)
          : null;
        const now = new Date();

        console.log(`🔍 Checking stored token validity:`, {
          hasToken: !!settings.storedToken.access_token,
          expiresAt: expiresAt ? expiresAt.toISOString() : "null",
          now: now.toISOString(),
          isValid: expiresAt && expiresAt > now,
        });

        if (expiresAt && expiresAt > now) {
          // Use stored token
          const expiresIn = Math.floor(
            (expiresAt.getTime() - Date.now()) / 1000
          );
          console.log(`✅ Using stored token (expires in ${expiresIn}s)`);

          this.tokenCache[subdomain] = {
            token: settings.storedToken.access_token,
            expiry: expiresAt.getTime(),
          };
          return {
            access_token: settings.storedToken.access_token,
            token: settings.storedToken.access_token,
            refresh_token: settings.storedToken.refresh_token,
            expires_in: expiresIn,
          };
        } else {
          console.log(`⚠️ Stored token expired or invalid, fetching new token`);
        }
      } else {
        console.log(`⚠️ No stored token found, fetching new token`);
      }

      // Get new token from QPay API
      console.log(
        `🔄 Fetching new token from QPay API: ${settings.baseURL}/v2/auth/token`
      );
      const authHeader = Buffer.from(
        `${settings.username}:${settings.password}`
      ).toString("base64");

      const response = await axios.post(
        `${settings.baseURL}/v2/auth/token`,
        { terminal_id: settings.terminalId },
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`📥 QPay API response status: ${response.status}`);

      if (response.data && response.data.access_token) {
        // Cache the token
        const expiresIn = response.data.expires_in || 3600;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        console.log(`✅ New token received (expires in ${expiresIn}s)`);

        this.tokenCache[subdomain] = {
          token: response.data.access_token,
          expiry: expiresAt.getTime(),
        };

        // Update stored token in database
        try {
          const organizationCollection = centralDb.collection("Organization");
          await organizationCollection.updateOne(
            { subdomain },
            {
              $set: {
                "qpay.token": {
                  access_token: response.data.access_token,
                  refresh_token: response.data.refresh_token || null,
                  expires_at: expiresAt,
                },
              },
            }
          );
          console.log(`💾 Token saved to database`);
        } catch (updateError) {
          console.error("❌ Failed to update token in database:", updateError);
          // Continue even if update fails
        }

        return {
          access_token: response.data.access_token,
          token: response.data.access_token,
          refresh_token: response.data.refresh_token || null,
          expires_in: expiresIn,
        };
      }

      console.log(`⚠️ Unexpected response format:`, response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Qpay getToken error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      });

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to get Qpay token";

      throw new Error(`Qpay API request failed: ${errorMessage}`);
    }
  }

  /**
   * Refresh access token for specific organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @returns {Promise<Object>} Token response
   */
  async refreshToken(centralDb, subdomain) {
    try {
      const cached = this.tokenCache[subdomain];
      if (!cached || !cached.token) {
        // If no cached token, get a new one
        return this.getToken(centralDb, subdomain);
      }

      const settings = await this.getOrganizationSettings(centralDb, subdomain);

      const response = await axios.post(
        `${settings.baseURL}/v2/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${cached.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.token) {
        const expiresIn = response.data.expires_in || 3600;
        this.tokenCache[subdomain] = {
          token: response.data.token,
          expiry: Date.now() + expiresIn * 1000,
        };
      }

      return response.data;
    } catch (error) {
      console.error(
        "Qpay refreshToken error:",
        error.response?.data || error.message
      );
      // If refresh fails, clear cache and get new token
      delete this.tokenCache[subdomain];
      return this.getToken(centralDb, subdomain);
    }
  }

  /**
   * Ensure we have a valid token for the organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @returns {Promise<void>}
   */
  async ensureToken(centralDb, subdomain) {
    const cached = this.tokenCache[subdomain];
    if (
      !cached ||
      !cached.token ||
      (cached.expiry && Date.now() >= cached.expiry)
    ) {
      await this.getToken(centralDb, subdomain);
    }
  }

  /**
   * Make authenticated request to Qpay API for specific organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response
   */
  async request(centralDb, subdomain, method, endpoint, data = null) {
    try {
      await this.ensureToken(centralDb, subdomain);

      const settings = await this.getOrganizationSettings(centralDb, subdomain);
      const cached = this.tokenCache[subdomain];

      if (!cached || !cached.token) {
        throw new Error("No valid token available. Please authenticate first.");
      }

      const config = {
        method,
        url: `${settings.baseURL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${cached.token}`,
          "Content-Type": "application/json",
        },
      };

      if (
        data &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        config.data = data;
        // Log invoice creation requests for debugging
        if (endpoint === "/v2/invoice") {
          console.log(
            `📝 Creating QPay invoice with data:`,
            JSON.stringify(data, null, 2)
          );
        }
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      // If token expired, try to refresh and retry once
      if (error.response?.status === 401) {
        try {
          await this.refreshToken(centralDb, subdomain);
          // Retry the request
          const settings = await this.getOrganizationSettings(
            centralDb,
            subdomain
          );
          const cached = this.tokenCache[subdomain];

          const config = {
            method,
            url: `${settings.baseURL}${endpoint}`,
            headers: {
              Authorization: `Bearer ${cached.token}`,
              "Content-Type": "application/json",
            },
          };

          if (
            data &&
            (method === "POST" || method === "PUT" || method === "PATCH")
          ) {
            config.data = data;
          }

          const response = await axios(config);
          return response.data;
        } catch (retryError) {
          // If refresh fails, get new token
          await this.getToken(centralDb, subdomain);
          // Retry one more time
          const settings = await this.getOrganizationSettings(
            centralDb,
            subdomain
          );
          const cached = this.tokenCache[subdomain];

          const config = {
            method,
            url: `${settings.baseURL}${endpoint}`,
            headers: {
              Authorization: `Bearer ${cached.token}`,
              "Content-Type": "application/json",
            },
          };

          if (
            data &&
            (method === "POST" || method === "PUT" || method === "PATCH")
          ) {
            config.data = data;
          }

          const response = await axios(config);
          return response.data;
        }
      }

      console.error(`❌ Qpay ${method} ${endpoint} error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        requestData: endpoint === "/v2/invoice" ? data : undefined,
      });

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        `Qpay API request failed`;

      throw new Error(errorMessage);
    }
  }

  // ==================== INVOICE ENDPOINTS ====================

  /**
   * Create invoice for organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise<Object>} Created invoice
   */
  async createInvoice(centralDb, subdomain, invoiceData) {
    return this.request(
      centralDb,
      subdomain,
      "POST",
      "/v2/invoice",
      invoiceData
    );
  }

  /**
   * Get invoice by ID for organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice data
   */
  async getInvoice(centralDb, subdomain, invoiceId) {
    return this.request(
      centralDb,
      subdomain,
      "GET",
      `/v2/invoice/${invoiceId}`
    );
  }

  /**
   * Cancel invoice for organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelInvoice(centralDb, subdomain, invoiceId) {
    return this.request(
      centralDb,
      subdomain,
      "DELETE",
      `/v2/invoice/${invoiceId}`
    );
  }

  // ==================== PAYMENT ENDPOINTS ====================

  /**
   * Check payment status for organization
   * @param {Object} centralDb - Central database connection
   * @param {string} subdomain - Organization subdomain
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPayment(centralDb, subdomain, invoiceId) {
    return this.request(centralDb, subdomain, "POST", "/v2/payment/check", {
      invoice_id: invoiceId,
    });
  }
}

// Export singleton instance
module.exports = new QpayService();
