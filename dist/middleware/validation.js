"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageSchema = exports.createNotificationSchema = exports.createPaymentSchema = exports.createInvoiceSchema = exports.createEpisodeSchema = exports.createWebtoonSchema = exports.changePasswordSchema = exports.createOrganizationSchema = exports.loginSchema = exports.registerSchema = exports.validateRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: error.details.map((detail) => ({
                    field: detail.path.join("."),
                    message: detail.message,
                })),
            });
        }
        req.body = value;
        next();
    };
};
exports.validateRequest = validateRequest;
// Common validation schemas
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required(),
    displayName: joi_1.default.string().min(2).max(50).required(),
    photoURL: joi_1.default.string().uri().optional(),
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
});
exports.createOrganizationSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    subdomain: joi_1.default.string().alphanum().min(3).max(30).required(),
    domain: joi_1.default.string().domain().optional(),
    settings: joi_1.default.object({
        theme: joi_1.default.string().valid("light", "dark").optional(),
        language: joi_1.default.string().length(2).optional(),
        timezone: joi_1.default.string().optional(),
        features: joi_1.default.object({
            webtoons: joi_1.default.boolean().optional(),
            analytics: joi_1.default.boolean().optional(),
            payments: joi_1.default.boolean().optional(),
            notifications: joi_1.default.boolean().optional(),
        }).optional(),
    }).optional(),
});
exports.changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required(),
    newPassword: joi_1.default.string().min(6).required(),
});
exports.createWebtoonSchema = joi_1.default.object({
    title: joi_1.default.string().min(1).max(200).required(),
    description: joi_1.default.string().max(1000).optional(),
    coverImage: joi_1.default.string().uri().optional(),
    categories: joi_1.default.array().items(joi_1.default.string()).optional(),
    tags: joi_1.default.array().items(joi_1.default.string()).optional(),
});
exports.createEpisodeSchema = joi_1.default.object({
    title: joi_1.default.string().min(1).max(200).required(),
    content: joi_1.default.string().optional(),
    images: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
});
exports.createInvoiceSchema = joi_1.default.object({
    amount: joi_1.default.number().min(0).required(),
    currency: joi_1.default.string().length(3).optional(),
    dueDate: joi_1.default.date().min("now").required(),
    items: joi_1.default.array()
        .items(joi_1.default.object({
        description: joi_1.default.string().required(),
        quantity: joi_1.default.number().min(1).required(),
        unitPrice: joi_1.default.number().min(0).required(),
    }))
        .min(1)
        .required(),
});
exports.createPaymentSchema = joi_1.default.object({
    amount: joi_1.default.number().min(0).required(),
    method: joi_1.default.string()
        .valid("card", "bank_transfer", "mobile_payment", "cash")
        .required(),
    transactionId: joi_1.default.string().optional(),
});
exports.createNotificationSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    organizationId: joi_1.default.string().optional(),
    title: joi_1.default.string().min(1).max(200).required(),
    message: joi_1.default.string().min(1).max(1000).required(),
    type: joi_1.default.string()
        .valid("info", "success", "warning", "error", "system")
        .optional(),
});
exports.sendMessageSchema = joi_1.default.object({
    receiverId: joi_1.default.string().required(),
    organizationId: joi_1.default.string().optional(),
    content: joi_1.default.string().min(1).max(2000).required(),
});
