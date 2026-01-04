require("dotenv").config();
const mongoose = require("mongoose");

async function debugQpay() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const CENTRAL_DB_NAME = process.env.CENTRAL_DB_NAME || "webix-udirdlaga";
  
  console.log("Connecting to central DB:", CENTRAL_DB_NAME);
  const conn = await mongoose.createConnection(`${MONGODB_URI}/${CENTRAL_DB_NAME}`).asPromise();
  
  const Organization = conn.collection("Organization");
  const subdomain = "yujoteam";
  const org = await Organization.findOne({ subdomain });
  
  if (!org) {
    console.error("Organization not found:", subdomain);
    process.exit(1);
  }
  
  console.log("Organization QPay Settings:");
  console.log(JSON.stringify(org.qpay, (key, value) => {
    if (key === "access_token" || key === "refresh_token" || key === "token") return "***";
    return value;
  }, 2));
  
  if (org.qpay && org.qpay.token) {
    console.log("Token Expiry:", org.qpay.token.expires_at);
    console.log("Current Time:", new Date());
    const isExpired = new Date(org.qpay.token.expires_at) < new Date();
    console.log("Is Expired:", isExpired);
  }

  process.exit(0);
}

debugQpay().catch(err => {
  console.error(err);
  process.exit(1);
});
