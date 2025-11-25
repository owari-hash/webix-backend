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

      // Get Qpay settings from organization.settings.qpay
      const qpaySettings = organization.settings?.qpay || {};

      if (
        !qpaySettings.username ||
        !qpaySettings.password ||
        !qpaySettings.terminal_id
      ) {
        throw new Error(
          `Qpay settings not configured for organization: ${subdomain}. Please configure Qpay credentials in organization settings.`
        );
      }

      return {
        baseURL: qpaySettings.base_url || this.baseURL,
        username: qpaySettings.username,
        password: qpaySettings.password,
        terminalId: qpaySettings.terminal_id,
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
      // Check cache first
      const cached = this.tokenCache[subdomain];
      if (cached && cached.expiry && Date.now() < cached.expiry) {
        return {
          token: cached.token,
          expires_in: Math.floor((cached.expiry - Date.now()) / 1000),
        };
      }

      // Get organization settings
      const settings = await this.getOrganizationSettings(centralDb, subdomain);

      const response = await axios.post(
        `${settings.baseURL}/v2/auth/token`,
        { terminal_id: settings.terminalId },
        {
          auth: {
            username: settings.username,
            password: settings.password,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.token) {
        // Cache the token
        const expiresIn = response.data.expires_in || 3600;
        this.tokenCache[subdomain] = {
          token: response.data.token,
          expiry: Date.now() + expiresIn * 1000,
        };
        return response.data;
      }

      return response.data;
    } catch (error) {
      console.error(
        "Qpay getToken error:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to get Qpay token"
      );
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

      console.error(
        `Qpay ${method} ${endpoint} error:`,
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          `Qpay API request failed: ${error.message}`
      );
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
