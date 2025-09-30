const express = require("express");
const app = express();
const mongoose = require("mongoose");
const http = require("http");
const cors = require("cors");
const server = http.Server(app);
const io = require("socket.io")(server);
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const khereglegchRoute = require("./routes/khereglegchRoute");
const baiguullagaRoute = require("./routes/baiguullagaRoute");
const aldaaBarigch = require("./middleware/aldaaBarigch");

const dbUrl =
  process.env.MONGODB_URI || "mongodb://localhost:27017/webix-backend";
mongoose
  .connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    console.log("MongoDB холбогдлоо");
    server.listen(process.env.PORT || 3000);
  })
  .catch((err) => console.log(err));

process.env.TZ = "Asia/Ulaanbaatar";

app.set("socketio", io);
app.use(cors());
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(khereglegchRoute);
app.use(baiguullagaRoute);

app.use(aldaaBarigch);
io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });
  socket.on("disconnect", () => {});
});
