require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");

async function fixAndTest() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const CENTRAL_DB_NAME = process.env.CENTRAL_DB_NAME || "webix-udirdlaga";
  
  console.log("Connecting to central DB...");
  const conn = await mongoose.createConnection(`${MONGODB_URI}/${CENTRAL_DB_NAME}`).asPromise();
  const Organization = conn.collection("Organization");
  const subdomain = "yujoteam";

  // 1. Clear the invalid token
  console.log(`Clearing cached token for ${subdomain}...`);
  await Organization.updateOne(
    { subdomain },
    { $unset: { "qpay.token": "" } }
  );
  console.log("Done.");

  // 2. Test fetching a NEW token with current .env credentials
  const org = await Organization.findOne({ subdomain });
  const terminalId = org.qpay?.credentials?.terminal_id || "95000059";
  const username = process.env.QPAY_USERNAME;
  const password = process.env.QPAY_PASSWORD;
  const baseURL = process.env.QPAY_BASE_URL || "https://quickqr.qpay.mn";

  console.log(`Testing token fetch for terminal: ${terminalId} at ${baseURL}`);
  
  const authHeader = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const response = await axios.post(
      `${baseURL}/v2/auth/token`,
      { terminal_id: terminalId },
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("SUCCESS! Got new token:", response.data.access_token ? "MASKED" : "NULL");
    console.log("Expires in:", response.data.expires_in);
  } catch (error) {
    console.error("FAILED to get token:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
  }

  process.exit(0);
}

fixAndTest().catch(console.error);
