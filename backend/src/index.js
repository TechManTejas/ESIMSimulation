import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const users = {};

io.on("connection", (socket) => {
  users[socket.id] = { userId: socket.id };
  io.emit("users", Object.values(users));

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("users", Object.values(users));
  });

  socket.on("call-user", (data) => {
    io.to(data.target).emit("offer", { from: data.from, sdp: data.sdp });
  });

  socket.on("accept-call", (data) => {
    io.to(data.target).emit("answer", { sdp: data.sdp });
  });

  socket.on("send-candidate", (data) => {
    io.to(data.target).emit("candidate", data.candidate);
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
