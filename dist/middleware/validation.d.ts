import { Request, Response, NextFunction } from "express";
import Joi from "joi";
export declare const validateRequest: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const registerSchema: Joi.ObjectSchema<any>;
export declare const loginSchema: Joi.ObjectSchema<any>;
export declare const createOrganizationSchema: Joi.ObjectSchema<any>;
export declare const changePasswordSchema: Joi.ObjectSchema<any>;
export declare const createWebtoonSchema: Joi.ObjectSchema<any>;
export declare const createEpisodeSchema: Joi.ObjectSchema<any>;
export declare const createInvoiceSchema: Joi.ObjectSchema<any>;
export declare const createPaymentSchema: Joi.ObjectSchema<any>;
export declare const createNotificationSchema: Joi.ObjectSchema<any>;
export declare const sendMessageSchema: Joi.ObjectSchema<any>;
//# sourceMappingURL=validation.d.ts.map