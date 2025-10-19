import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();

// ✅ CORS for your deployed frontend only
app.use(
  cors({
    origin: "https://zenchat-frontend10.onrender.com",
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

app.get("/", (_, res) => res.send("✅ Socket.IO Signaling Server Running"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://zenchat-frontend10.onrender.com",
    methods: ["GET", "POST"],
  },
});

// Map of userId -> socketId
const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("🔗 Client connected:", socket.id);

  const { userId } = socket.handshake.auth || {};
  if (userId) userSocketMap.set(userId, socket.id);

  socket.on("newOffer", ({ newOffer, sendToUserId }) => {
    const receiverSocketId = userSocketMap.get(sendToUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newOfferAwaiting", {
        offer: newOffer,
        offererUserId: userId,
      });
    }
  });

  socket.on("newAnswer", (offerObj, callback) => {
    const offererSocketId = userSocketMap.get(offerObj.offererUserId);
    if (offererSocketId) {
      io.to(offererSocketId).emit("answerResponse", offerObj);
    }
    if (callback) callback([]);
  });

  socket.on("sendIceCandidateToSignalingServer", (data) => {
    const targetSocketId = userSocketMap.get(
      data.didIOffer ? data.sendToUserId : data.iceUserId
    );
    if (targetSocketId) {
      io.to(targetSocketId).emit(
        "receivedIceCandidateFromServer",
        data.iceCandidate
      );
    }
  });

  socket.on("hangupCall", (targetUserId) => {
    const targetSocketId = userSocketMap.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("hangupCallReq", true);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    for (const [uid, sid] of userSocketMap.entries()) {
      if (sid === socket.id) {
        userSocketMap.delete(uid);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`✅ Socket.IO signaling server running on port ${PORT}`)
);
