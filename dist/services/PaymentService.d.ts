import { CreateInvoiceDto, PaymentDto, PaginatedResponse } from "../types";
export declare class PaymentService {
    createInvoice(organizationId: string, invoiceData: CreateInvoiceDto): Promise<any>;
    getInvoices(organizationId: string, page?: number, limit?: number, status?: string): Promise<PaginatedResponse<any>>;
    getInvoiceById(invoiceId: string, organizationId: string): Promise<any>;
    updateInvoice(invoiceId: string, updateData: Partial<CreateInvoiceDto>, organizationId: string): Promise<any>;
    deleteInvoice(invoiceId: string, organizationId: string): Promise<void>;
    processPayment(invoiceId: string, paymentData: PaymentDto, organizationId: string): Promise<any>;
    getPayments(organizationId: string, page?: number, limit?: number): Promise<PaginatedResponse<any>>;
    getPaymentById(paymentId: string, organizationId: string): Promise<any>;
    getPaymentStats(organizationId: string, startDate: Date, endDate: Date): Promise<any>;
    refundPayment(paymentId: string, organizationId: string): Promise<any>;
    getOverdueInvoices(organizationId: string): Promise<any[]>;
    cancelInvoice(invoiceId: string, organizationId: string): Promise<any>;
}
//# sourceMappingURL=PaymentService.d.ts.map