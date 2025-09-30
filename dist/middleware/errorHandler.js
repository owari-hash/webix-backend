"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFound = exports.errorHandler = exports.CustomError = void 0;
const AuditLog_1 = require("../models/AuditLog");
class CustomError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.CustomError = CustomError;
const errorHandler = async (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    // Log error
    console.error("Error:", err);
    // Log to audit log if user is authenticated
    if (req.user) {
        try {
            await AuditLog_1.AuditLog.logAction({
                userId: req.user.userId,
                organizationId: req.organization?._id,
                action: "error_occurred",
                resource: "system",
                resourceId: "error",
                metadata: {
                    error: err.message,
                    stack: err.stack,
                    url: req.url,
                    method: req.method,
                },
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
            });
        }
        catch (auditError) {
            console.error("Failed to log error to audit log:", auditError);
        }
    }
    // Mongoose bad ObjectId
    if (err.name === "CastError") {
        const message = "Resource not found";
        error = new CustomError(message, 404);
    }
    // Mongoose duplicate key
    if (err.name === "MongoError" && err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} already exists`;
        error = new CustomError(message, 400);
    }
    // Mongoose validation error
    if (err.name === "ValidationError") {
        const message = Object.values(err.errors)
            .map((val) => val.message)
            .join(", ");
        error = new CustomError(message, 400);
    }
    // JWT errors
    if (err.name === "JsonWebTokenError") {
        const message = "Invalid token";
        error = new CustomError(message, 401);
    }
    if (err.name === "TokenExpiredError") {
        const message = "Token expired";
        error = new CustomError(message, 401);
    }
    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
const notFound = (req, res, next) => {
    const error = new CustomError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};
exports.notFound = notFound;
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
