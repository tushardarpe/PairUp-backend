const express = require("express");
const app = express();
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");

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

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/request", requestRouter);
app.use("/api/user", userRouter);

const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

connectDB()
  .then(() => {
    console.log("Database connected successfully");
    app.listen(7777, () => {
      console.log("server has been successfully listening on port 7777");
    });
  })
  .catch((err) => {
    console.log("Error connecting to database", err);
  });
