import express from "express";
import http from "http";
import { Server } from "socket.io";
import mysql from "mysql2/promise";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// MySQL connection
const db = await mysql.createConnection({
  host: "sql103.infinityfree.com",
  user: "if0_39531346",
  password: "m08js19QJQoI",
  database: "if0_39531346_sstracker"
});

// API route to check if backend is alive
app.get("/", (req, res) => {
  res.send("Sonic Shuriken Tracker backend is running");
});

// Socket.IO for real-time
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join_user", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined`);
  });

  socket.on("update_tasks", (data) => {
    io.to(`user_${data.userId}`).emit("tasks_updated", data);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
