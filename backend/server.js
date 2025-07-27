import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("A user connected, socket id:", socket.id);

  // Join user room to isolate events per user
  socket.on("joinUserRoom", (userId) => {
    const room = `user_${userId}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  // When a task is toggled (checked/unchecked)
  socket.on("taskToggled", (data) => {
    const room = `user_${data.userId}`;
    // Broadcast to others in the same user room except sender
    socket.to(room).emit("taskUpdated", {
      taskId: data.taskId,
      isDone: data.isDone,
    });
  });

  // When a new task is added
  socket.on("taskAdded", (data) => {
    const room = `user_${data.userId}`;
    socket.to(room).emit("taskAdded", {
      tabId: data.tabId,
      task: data.task, // task object with id, name, is_done, sort_order etc
    });
  });

  // When tasks are reordered in a tab
  socket.on("tasksReordered", (data) => {
    const room = `user_${data.userId}`;
    socket.to(room).emit("tasksReordered", {
      tabId: data.tabId,
      taskIds: data.taskIds, // Array of task IDs in new order
    });
  });

  // When a tab is added
  socket.on("tabAdded", (data) => {
    const room = `user_${data.userId}`;
    socket.to(room).emit("tabAdded", {
      tab: data.tab, // tab object with id, name, user_id
    });
  });

  // When a tab is deleted
  socket.on("tabDeleted", (data) => {
    const room = `user_${data.userId}`;
    socket.to(room).emit("tabDeleted", {
      tabId: data.tabId,
    });
  });

  // When the active tab changes
  socket.on("activeTabChanged", (data) => {
    const room = `user_${data.userId}`;
    socket.to(room).emit("activeTabChanged", {
      tabId: data.tabId,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected, socket id:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
