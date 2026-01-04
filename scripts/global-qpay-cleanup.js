require("dotenv").config();
const mongoose = require("mongoose");

async function cleanupAllOrgs() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const CENTRAL_DB_NAME = process.env.CENTRAL_DB_NAME || "webix-udirdlaga";
  
  console.log("Connecting to central DB for global cleanup...");
  const conn = await mongoose.createConnection(`${MONGODB_URI}/${CENTRAL_DB_NAME}`).asPromise();
  const Organization = conn.collection("Organization");

  // Find all organizations with a token expiry beyond 2040
  const cutoffDate = new Date("2040-01-01");
  
  const poisonedOrgs = await Organization.find({
    "qpay.token.expires_at": { $gt: cutoffDate }
  }).toArray();

  if (poisonedOrgs.length === 0) {
    console.log("No other poisoned organizations found.");
  } else {
    console.log(`Found ${poisonedOrgs.length} poisoned organizations. Clearing tokens...`);
    for (const org of poisonedOrgs) {
      console.log(`- Clearing token for: ${org.subdomain} (Expiry was: ${org.qpay.token.expires_at})`);
      await Organization.updateOne(
        { _id: org._id },
        { $unset: { "qpay.token": "" } }
      );
    }
    console.log("Global cleanup complete.");
  }

  process.exit(0);
}

cleanupAllOrgs().catch(console.error);
