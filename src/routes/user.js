const express = require("express");
const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const userRouter = express.Router();

const USER_SAFE_DATA = "firstName lastName gender photoUrl age about skills";

userRouter.get("/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const revceivedRequests = await ConnectionRequest.find({
      toUserId: loggedInUser._id,
      status: "interested",
    }).populate(
      "fromUserId",
      "firstName lastName gender age photoUrl skills about",
    );

    res.json({
      message: "Received connection requests",
      data: revceivedRequests,
    });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

userRouter.get("/connections", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const connections = await ConnectionRequest.find({
      $or: [
        { toUserId: loggedInUser._id, status: "accepted" },
        { fromUserId: loggedInUser._id, status: "accepted" },
      ],
    })
      .populate("fromUserId", "firstName lastName gender age photoUrl about skills")
      .populate("toUserId", "firstName lastName gender age photoUrl about skills");

    const data = connections.map((connection) => {
      if (connection.fromUserId._id.equals(loggedInUser._id)) {
        return connection.toUserId;
      }
      return connection.fromUserId;
    });

    res.json({
      message: "Connected users",
      data: data,
    });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

userRouter.get("/feed", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    // const page = parseInt(req.query.page) || 1;
    // let limit = parseInt(req.query.limit) || 10;
    // limit = limit > 50 ? 50 : limit;
    // const skip = (page - 1) * limit;

    let limit = parseInt(req.query.limit) || 10;
    limit = Math.min(limit, 50);

    // Find all the connection requests (sent + received)
    const connectionRequests = await ConnectionRequest.find({
      $or: [{ fromUserId: loggedInUser._id }, { toUserId: loggedInUser._id }],
    }).select("fromUserId toUserId");

    const hideUsersFromFeed = new Set();
    connectionRequests.forEach((req) => {
      hideUsersFromFeed.add(req.fromUserId.toString());
      hideUsersFromFeed.add(req.toUserId.toString());
    });

    const users = await User.find({
      $and: [
        { _id: { $nin: Array.from(hideUsersFromFeed) } },
        { _id: { $ne: loggedInUser._id } },
      ],
    })
      .select(USER_SAFE_DATA)
      .limit(limit);

    res.send(users);
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

module.exports = userRouter;
