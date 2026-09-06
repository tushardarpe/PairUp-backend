require("dotenv").config();
const express = require("express");
const app = express();
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const initializeSocket = require("./utils/socket");

require("./utils/cronjob");

app.use(
  cors({
    origin: "http://localhost:4200",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const chatRouter = require("./routes/chat");
const paymentRouter = require("./routes/payment");

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/request", requestRouter);
app.use("/api/user", userRouter);
app.use("/api/chats", chatRouter);
app.use("/api/payment", paymentRouter);

const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const server = http.createServer(app);
initializeSocket(server);

connectDB()
  .then(() => {
    console.log("Database connected successfully");
    server.listen(process.env.PORT, () => {
      console.log(
        `server has been successfully listening on port ${process.env.PORT}`,
      );
    });
  })
  .catch((err) => {
    console.log("Error connecting to database", err);
  });
