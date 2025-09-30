"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./config/database"));
const errorHandler_1 = require("./middleware/errorHandler");
// Load environment variables
dotenv_1.default.config();
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const organization_1 = __importDefault(require("./routes/organization"));
const webtoon_1 = __importDefault(require("./routes/webtoon"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const payment_1 = __importDefault(require("./routes/payment"));
const notification_1 = __importDefault(require("./routes/notification"));
const message_1 = __importDefault(require("./routes/message"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});
exports.io = io;
// Set timezone
process.env.TZ = "Asia/Ulaanbaatar";
// Connect to database
(0, database_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);
// Body parsing middleware
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Set socket.io instance
app.set("socketio", io);
// Routes
app.use("/api/auth", auth_1.default);
app.use("/api/organizations", organization_1.default);
app.use("/api/webtoons", webtoon_1.default);
app.use("/api/analytics", analytics_1.default);
app.use("/api/payments", payment_1.default);
app.use("/api/notifications", notification_1.default);
app.use("/api/messages", message_1.default);
// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Webix API is running",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
    });
});
// Socket.io connection handling
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    // Join user to their personal room
    socket.on("join-user-room", (userId) => {
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined their room`);
    });
    // Join organization room
    socket.on("join-organization-room", (organizationId) => {
        socket.join(`org:${organizationId}`);
        console.log(`User joined organization ${organizationId}`);
    });
    // Handle chat messages
    socket.on("send-message", (data) => {
        socket.to(`user:${data.receiverId}`).emit("new-message", data);
    });
    // Handle notifications
    socket.on("send-notification", (data) => {
        socket.to(`user:${data.userId}`).emit("new-notification", data);
    });
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});
// Error handling middleware
app.use(errorHandler_1.notFound);
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`⏰ Timezone: ${process.env.TZ}`);
});
