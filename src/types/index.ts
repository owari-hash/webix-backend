export interface User {
  _id?: string;
  email: string;
  passwordHash: string;
  displayName: string;
  photoURL?: string;
  role: "super_admin" | "org_admin" | "org_moderator" | "org_user" | "viewer";
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  _id?: string;
  name: string;
  subdomain: string;
  domain?: string;
  status: "active" | "inactive" | "suspended" | "pending";
  settings: {
    theme: string;
    language: string;
    timezone: string;
    features: {
      webtoons: boolean;
      analytics: boolean;
      payments: boolean;
      notifications: boolean;
    };
  };
  subscription: {
    plan: "free" | "basic" | "professional" | "enterprise";
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserOrganization {
  _id?: string;
  userId: string;
  organizationId: string;
  role: "admin" | "moderator" | "user" | "viewer";
  permissions: string[];
  joinedAt: Date;
  isActive: boolean;
}

export interface Session {
  _id?: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface Webtoon {
  _id?: string;
  organizationId: string;
  title: string;
  description?: string;
  coverImage?: string;
  status: "draft" | "published" | "archived";
  categories: string[];
  tags: string[];
  createdBy: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebtoonEpisode {
  _id?: string;
  webtoonId: string;
  title: string;
  episodeNumber: number;
  content?: string;
  images: string[];
  status: "draft" | "published" | "archived";
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Analytics {
  _id?: string;
  organizationId?: string;
  userId?: string;
  webtoonId?: string;
  metricType:
    | "user_activity"
    | "content_views"
    | "organization_growth"
    | "revenue"
    | "system_performance"
    | "webtoon_views"
    | "user_registration"
    | "login_attempts";
  metricValue: number;
  metadata?: any;
  date: Date;
  createdAt: Date;
}

export interface Invoice {
  _id?: string;
  organizationId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  _id?: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: "card" | "bank_transfer" | "mobile_payment" | "cash";
  transactionId?: string;
  status: "pending" | "completed" | "failed" | "refunded";
  processedAt?: Date;
  createdAt: Date;
}

export interface Notification {
  _id?: string;
  userId: string;
  organizationId?: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "system";
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface Message {
  _id?: string;
  senderId: string;
  receiverId: string;
  organizationId?: string;
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface AuditLog {
  _id?: string;
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// DTOs
export interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
  photoURL?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateOrganizationDto {
  name: string;
  subdomain: string;
  domain?: string;
  settings?: Partial<Organization["settings"]>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalWebtoons: number;
  totalViews: number;
  revenue: number;
}

export interface WebtoonAnalytics {
  totalViews: number;
  uniqueViewers: number;
  averageRating: number;
}

export interface CreateInvoiceDto {
  amount: number;
  currency?: string;
  dueDate: Date;
  items: InvoiceItem[];
}

export interface PaymentDto {
  amount: number;
  method: "card" | "bank_transfer" | "mobile_payment" | "cash";
  transactionId?: string;
}

export interface CreateNotificationDto {
  userId: string;
  organizationId?: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error" | "system";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}
