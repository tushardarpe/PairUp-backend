const express = require("express");
const chatRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const Chat = require("../models/chat");

chatRouter.get("/:toUserId", userAuth, async (req, res) => {
  const { toUserId } = req.params;
  const fromUserId = req.user._id;

  try {
    let chat = await Chat.findOne({
      participants: { $all: [fromUserId, toUserId] },
    }).populate({
      path: "messages.senderId",
      select: "firstName lastName",
    });

    if (!chat) {
      chat = new Chat({
        participants: [fromUserId, toUserId],
        messages: [],
      });

      await chat.save();
    }

    res.json(chat);
  } catch (err) {
    console.log("Error fetching chat messages:", err);
  }
});

module.exports = chatRouter;
