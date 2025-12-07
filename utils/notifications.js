/**
 * Notification Helper
 * Creates and manages notifications for various events
 */

/**
 * Create a notification in the database
 * @param {Object} params - Notification parameters
 * @param {Object} params.tenantDb - Tenant database connection
 * @param {string} params.userId - User ID to notify
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.subdomain - Organization subdomain
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} Created notification
 */
async function createNotification({
  tenantDb,
  userId,
  type,
  title,
  message,
  subdomain,
  metadata = {},
}) {
  try {
    const notificationsCollection = tenantDb.db.collection("notifications");
    const mongoose = require("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    // Convert userId to ObjectId if it's a string
    const userIdObj =
      typeof userId === "string" ? new ObjectId(userId) : userId;

    const notification = {
      user_id: userIdObj,
      type: type,
      title: title,
      message: message,
      is_read: false,
      subdomain: subdomain,
      metadata: metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);
    return { ...notification, _id: result.insertedId };
  } catch (error) {
    console.error("Create notification error:", error);
    throw error;
  }
}

/**
 * Notify all admin users in an organization
 * @param {Object} params - Parameters
 * @param {Object} params.tenantDb - Tenant database connection
 * @param {string} params.subdomain - Organization subdomain
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Array>} Created notifications
 */
async function notifyAdmins({
  tenantDb,
  subdomain,
  type,
  title,
  message,
  metadata = {},
}) {
  try {
    // Find all admin users
    const usersCollection = tenantDb.db.collection("users");
    const UserCollection = tenantDb.db.collection("User");

    // Try both collections
    let admins = await usersCollection
      .find({ role: "admin", subdomain: subdomain })
      .toArray();

    if (admins.length === 0) {
      admins = await UserCollection.find({
        role: "admin",
        subdomain: subdomain,
      }).toArray();
    }

    // Create notifications for all admins
    const notifications = [];
    for (const admin of admins) {
      try {
        const notification = await createNotification({
          tenantDb,
          userId: admin._id, // Pass ObjectId directly
          type,
          title,
          message,
          subdomain,
          metadata,
        });
        notifications.push(notification);
      } catch (error) {
        console.error(
          `Failed to create notification for admin ${admin._id}:`,
          error
        );
      }
    }

    return notifications;
  } catch (error) {
    console.error("Notify admins error:", error);
    throw error;
  }
}

/**
 * Notify a specific user
 * @param {Object} params - Parameters
 * @param {Object} params.tenantDb - Tenant database connection
 * @param {string} params.userId - User ID to notify
 * @param {string} params.subdomain - Organization subdomain
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} Created notification
 */
async function notifyUser({
  tenantDb,
  userId,
  subdomain,
  type,
  title,
  message,
  metadata = {},
}) {
  try {
    return await createNotification({
      tenantDb,
      userId,
      type,
      title,
      message,
      subdomain,
      metadata,
    });
  } catch (error) {
    console.error("Notify user error:", error);
    throw error;
  }
}

module.exports = {
  createNotification,
  notifyAdmins,
  notifyUser,
};
