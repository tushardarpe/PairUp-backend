const socket = require("socket.io");
const crypto = require("crypto");
const Chat = require("../models/chat");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const ConnectionRequest = require("../models/connectionRequest");

const getSecretRoomId = (fromUserId, toUserId) => {
  return crypto
    .createHash("sha256")
    .update([fromUserId, toUserId].sort().join("_"))
    .digest("hex");
};

const emitPresenceToConnections = async (io, userId, presence) => {
  const connections = await ConnectionRequest.find({
    status: "accepted",
    $or: [{ fromUserId: userId }, { toUserId: userId }],
  }).select("fromUserId toUserId");

  for (const connection of connections) {
    const otherUserId =
      connection.fromUserId.toString() === userId
        ? connection.toUserId.toString()
        : connection.fromUserId.toString();

    io.to(`user:${otherUserId}`).emit("presenceChanged", {
      userId,
      ...presence,
    });
  }
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "http://localhost:4200",
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        return next(new Error("Authentication required"));
      }

      const token = cookieHeader
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decodedObj = jwt.verify(token, process.env.JWT_SECRET_KEY);

      const user = await User.findById(decodedObj._id).select("-password");

      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach authenticated user to socket
      socket.user = user;

      next();
    } catch (err) {
      console.log("Socket authentication failed:", err.message);

      next(new Error("Authentication failed"));
    }
  });

  // Only authenticated sockets reach here
  io.on("connection", async (socket) => {
    console.log(
      "Authenticated socket user:",
      socket.user.firstName,
      socket.user._id,
    );

    const userId = socket.user._id.toString();
    const userRoom = `user:${userId}`;

    // Count existing tabs/devices before this socket joins.
    const existingSockets = io.sockets.adapter.rooms.get(userRoom)?.size ?? 0;

    socket.join(userRoom);

    // Mark online only when the first tab/device connects.
    if (existingSockets === 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { isOnline: true },
      });

      await emitPresenceToConnections(io, userId, {
        isOnline: true,
        lastSeen: null,
      });
    }

    socket.on("joinChat", async ({ toUserId }) => {
      try {
        const fromUserId = socket.user._id;

        // Check whether both users are connected
        const connection = await ConnectionRequest.findOne({
          $or: [
            {
              fromUserId,
              toUserId,
              status: "accepted",
            },
            {
              fromUserId: toUserId,
              toUserId: fromUserId,
              status: "accepted",
            },
          ],
        });
        // User is not connected to the target user
        if (!connection) {
          console.log(`User ${fromUserId} is not connected to ${toUserId}`);

          socket.emit("chatError", {
            message: "You can only chat with your connections.",
          });

          return;
        }

        // Both users are connected
        const roomId = getSecretRoomId(fromUserId, toUserId);
        console.log(`${socket.user.firstName} joined room: ${roomId}`);
        socket.join(roomId);
      } catch (err) {
        console.log("Error joining chat:", err);

        socket.emit("chatError", {
          message: "Unable to join chat.",
        });
      }
    });

    socket.on("sendMessage", async ({ toUserId, text }) => {
      // Save messages to the database

      try {
        const fromUserId = socket.user._id;

        // Check whether sender and receiver are connected
        const connection = await ConnectionRequest.findOne({
          $or: [
            {
              fromUserId,
              toUserId,
              status: "accepted",
            },
            {
              fromUserId: toUserId,
              toUserId: fromUserId,
              status: "accepted",
            },
          ],
        });

        // Not connected → reject message
        if (!connection) {
          console.log(
            `Message rejected: ${fromUserId} is not connected to ${toUserId}`,
          );

          socket.emit("chatError", {
            message: "You can only message your connections.",
          });

          return;
        }

        // Generate the private room ID
        const roomId = getSecretRoomId(fromUserId, toUserId);
        console.log(socket.user.firstName, text);

        // Find existing chat
        let chat = await Chat.findOne({
          participants: { $all: [fromUserId, toUserId] },
        });

        // Create chat if it doesn't exist
        if (!chat) {
          chat = new Chat({
            participants: [fromUserId, toUserId],
            messages: [],
          });
        }

        // Save message
        chat.messages.push({
          senderId: fromUserId,
          text,
        });

        await chat.save();
        io.to(roomId).emit("messageReceived", {
          fromUserId,
          firstName: socket.user.firstName,
          text,
          ts: Date.now(),
        });
      } catch (err) {
        console.log("Error sending message:", err);

        socket.emit("chatError", {
          message: "Unable to send message.",
        });
      }
    });

    socket.on("disconnect", async () => {
      // Socket.IO has already removed this socket from its rooms.
      const remainingSockets =
        io.sockets.adapter.rooms.get(userRoom)?.size ?? 0;

      // Another tab/device is still connected.
      if (remainingSockets > 0) {
        return;
      }

      const lastSeen = new Date();

      await User.findByIdAndUpdate(userId, {
        $set: {
          isOnline: false,
          lastSeen,
        },
      });

      await emitPresenceToConnections(io, userId, {
        isOnline: false,
        lastSeen,
      });
    });
  });
};

module.exports = initializeSocket;
