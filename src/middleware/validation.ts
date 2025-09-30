import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

// Common validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  displayName: Joi.string().min(2).max(50).required(),
  photoURL: Joi.string().uri().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const createOrganizationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  subdomain: Joi.string().alphanum().min(3).max(30).required(),
  domain: Joi.string().domain().optional(),
  settings: Joi.object({
    theme: Joi.string().valid("light", "dark").optional(),
    language: Joi.string().length(2).optional(),
    timezone: Joi.string().optional(),
    features: Joi.object({
      webtoons: Joi.boolean().optional(),
      analytics: Joi.boolean().optional(),
      payments: Joi.boolean().optional(),
      notifications: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export const createWebtoonSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional(),
  coverImage: Joi.string().uri().optional(),
  categories: Joi.array().items(Joi.string()).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

export const createEpisodeSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  content: Joi.string().optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
});

export const createInvoiceSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  currency: Joi.string().length(3).optional(),
  dueDate: Joi.date().min("now").required(),
  items: Joi.array()
    .items(
      Joi.object({
        description: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        unitPrice: Joi.number().min(0).required(),
      })
    )
    .min(1)
    .required(),
});

export const createPaymentSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  method: Joi.string()
    .valid("card", "bank_transfer", "mobile_payment", "cash")
    .required(),
  transactionId: Joi.string().optional(),
});

export const createNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  organizationId: Joi.string().optional(),
  title: Joi.string().min(1).max(200).required(),
  message: Joi.string().min(1).max(1000).required(),
  type: Joi.string()
    .valid("info", "success", "warning", "error", "system")
    .optional(),
});

export const sendMessageSchema = Joi.object({
  receiverId: Joi.string().required(),
  organizationId: Joi.string().optional(),
  content: Joi.string().min(1).max(2000).required(),
});
