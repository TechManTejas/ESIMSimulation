import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { ExpressPeerServer } from "peer";
import cors from "cors";

// App for Socket.IO
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Separate app for PeerJS
const peerApp = express();
const peerServer = createServer(peerApp);
const peerPort = 9000; // Different port for PeerJS

// PeerJS server
const peerExpressServer = ExpressPeerServer(peerServer, {
  debug: true,
  path: "/", // Default path
});

peerApp.use("/peerjs", peerExpressServer); // Mount PeerJS server on '/peerjs' path

// CORS middleware
app.use(cors());

// Socket.IO server
let users = {}; // Store users with their socket IDs

io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("new-user", (userId) => {
    users[socket.id] = userId;
    io.emit("all-users", users);
  });

  socket.on("call-user", ({ userToCall, from }) => {
    io.to(getSocketId(userToCall)).emit("call-made", {
      from,
      signal: userToCall.signal,
    });
  });

  socket.on("make-answer", (data) => {
    io.to(getSocketId(data.to)).emit("answer-made", {
      socket: socket.id,
      signal: data.signal,
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("all-users", users);
  });

  function getSocketId(userId) {
    return Object.keys(users).find((key) => users[key] === userId);
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Socket.IO Server running on port ${PORT}`);
});

peerServer.listen(peerPort, "0.0.0.0", () => {
  console.log(`PeerJS Server running on port ${peerPort}`);
});
