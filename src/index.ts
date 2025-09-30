import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import connectDB from "./config/database";
import { errorHandler, notFound } from "./middleware/errorHandler";

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from "./routes/auth";
import organizationRoutes from "./routes/organization";
import webtoonRoutes from "./routes/webtoon";
import analyticsRoutes from "./routes/analytics";
import paymentRoutes from "./routes/payment";
import notificationRoutes from "./routes/notification";
import messageRoutes from "./routes/message";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Set timezone
process.env.TZ = "Asia/Ulaanbaatar";

// Connect to database
connectDB();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Set socket.io instance
app.set("socketio", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/webtoons", webtoonRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);

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
  socket.on("join-user-room", (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join organization room
  socket.on("join-organization-room", (organizationId: string) => {
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
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ Timezone: ${process.env.TZ}`);
});

export { io };
