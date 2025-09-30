# 🚀 Webix Multitenant Management System - Backend API

A comprehensive **Node.js/TypeScript backend API** for a **multitenant webtoon management platform** built with MongoDB, featuring dynamic subdomains, real-time notifications, analytics, and payment processing.

## ✨ Key Features

- **🏢 Multi-Organization Management** - Dynamic subdomain system with organization isolation
- **👥 Comprehensive User Management** - Role-based access control with granular permissions
- **📚 Content Management** - Webtoon and episode management with rich media support
- **📊 Advanced Analytics** - Real-time analytics with MongoDB aggregation pipelines
- **💳 Payment & Billing** - Complete invoice and payment processing system
- **🔔 Real-time Notifications** - Socket.io powered real-time messaging and notifications
- **🔐 Security** - JWT authentication, rate limiting, input validation, and audit logging
- **🌍 Internationalization** - Mongolian language support with timezone handling

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js with Express Router
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT + Refresh Tokens
- **Real-time:** Socket.io
- **Validation:** Joi
- **Security:** Helmet, CORS, Rate Limiting
- **File Storage:** AWS S3 (configurable)
- **Email:** SendGrid (configurable)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5.0+
- npm or yarn

### Installation

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd webix-backend
npm install
```

2. **Environment setup:**

```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Start development server:**

```bash
npm run dev
```

4. **Build for production:**

```bash
npm run build
npm start
```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint                    | Description          | Auth Required |
| ------ | --------------------------- | -------------------- | ------------- |
| POST   | `/api/auth/register`        | Register new user    | No            |
| POST   | `/api/auth/login`           | User login           | No            |
| POST   | `/api/auth/refresh`         | Refresh access token | No            |
| POST   | `/api/auth/logout`          | Logout user          | Yes           |
| POST   | `/api/auth/change-password` | Change password      | Yes           |
| GET    | `/api/auth/profile`         | Get user profile     | Yes           |

### Organization Management

| Method | Endpoint                                  | Description         | Auth Required |
| ------ | ----------------------------------------- | ------------------- | ------------- |
| POST   | `/api/organizations`                      | Create organization | Yes           |
| GET    | `/api/organizations`                      | List organizations  | Yes           |
| GET    | `/api/organizations/:id`                  | Get organization    | Yes           |
| PUT    | `/api/organizations/:id`                  | Update organization | Yes           |
| DELETE | `/api/organizations/:id`                  | Delete organization | Yes           |
| GET    | `/api/organizations/subdomain/:subdomain` | Get by subdomain    | No            |

### Content Management (Webtoons)

| Method | Endpoint                            | Description    | Auth Required |
| ------ | ----------------------------------- | -------------- | ------------- |
| POST   | `/api/webtoons/:orgId`              | Create webtoon | Yes           |
| GET    | `/api/webtoons/:orgId`              | List webtoons  | Yes           |
| GET    | `/api/webtoons/:orgId/:id`          | Get webtoon    | Yes           |
| PUT    | `/api/webtoons/:orgId/:id`          | Update webtoon | Yes           |
| DELETE | `/api/webtoons/:orgId/:id`          | Delete webtoon | Yes           |
| POST   | `/api/webtoons/:orgId/:id/episodes` | Create episode | Yes           |
| GET    | `/api/webtoons/:orgId/:id/episodes` | List episodes  | Yes           |

### Analytics & Reporting

| Method | Endpoint                             | Description         | Auth Required |
| ------ | ------------------------------------ | ------------------- | ------------- |
| GET    | `/api/analytics/:orgId/dashboard`    | Dashboard metrics   | Yes           |
| GET    | `/api/analytics/:orgId/webtoons/:id` | Webtoon analytics   | Yes           |
| GET    | `/api/analytics/:orgId/revenue`      | Revenue analytics   | Yes           |
| POST   | `/api/analytics/track`               | Track custom metric | Yes           |

### Payment & Billing

| Method | Endpoint                                     | Description        | Auth Required |
| ------ | -------------------------------------------- | ------------------ | ------------- |
| POST   | `/api/payments/:orgId/invoices`              | Create invoice     | Yes           |
| GET    | `/api/payments/:orgId/invoices`              | List invoices      | Yes           |
| POST   | `/api/payments/:orgId/invoices/:id/payments` | Process payment    | Yes           |
| GET    | `/api/payments/:orgId/stats`                 | Payment statistics | Yes           |

### Notifications & Messaging

| Method | Endpoint                      | Description       | Auth Required |
| ------ | ----------------------------- | ----------------- | ------------- |
| GET    | `/api/notifications`          | Get notifications | Yes           |
| PUT    | `/api/notifications/:id/read` | Mark as read      | Yes           |
| POST   | `/api/messages`               | Send message      | Yes           |
| GET    | `/api/messages/conversations` | Get conversations | Yes           |

## 🔐 Authentication & Authorization

### User Roles

- **super_admin** - Full system access
- **org_admin** - Organization administration
- **org_moderator** - Content moderation
- **org_user** - Regular user
- **viewer** - Read-only access

### Permissions

- `org:read`, `org:write`, `org:delete` - Organization management
- `user:read`, `user:write`, `user:delete` - User management
- `content:read`, `content:write`, `content:delete` - Content management
- `analytics:read` - Analytics access
- `reports:read`, `reports:write` - Report management
- `payments:read`, `payments:write` - Payment management

## 🏗️ Database Schema

### Core Models

- **User** - User accounts and authentication
- **Organization** - Multi-tenant organizations
- **UserOrganization** - User-organization relationships
- **Session** - JWT session management
- **Webtoon** - Webtoon content
- **WebtoonEpisode** - Individual episodes
- **Analytics** - Usage and performance metrics
- **Invoice** - Billing and invoicing
- **Payment** - Payment processing
- **Notification** - User notifications
- **Message** - User messaging
- **AuditLog** - System audit trail

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/webix-multitenant

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# AWS Configuration (optional)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=webix-uploads

# Email Configuration (optional)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@webix.mn
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Production Checklist

- [ ] Set secure JWT secrets
- [ ] Configure MongoDB with authentication
- [ ] Set up SSL/TLS certificates
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline

## 📊 Monitoring & Analytics

### Built-in Analytics

- User activity tracking
- Content performance metrics
- Revenue analytics
- System performance monitoring
- Real-time dashboard metrics

### Audit Logging

- All user actions are logged
- System events tracked
- Security events monitored
- Compliance reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Changelog

### v1.0.0

- Initial release
- Multi-tenant architecture
- Complete API implementation
- Real-time features
- Analytics and reporting
- Payment processing
