import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory store for demo (replace with DB logic)
const userRooms = new Map(); // userId -> Set(socketIds)
const userTabs = new Map(); // userId -> current tabId
const userTasks = new Map(); // userId -> { tabId: [tasks] }

// Helper to broadcast to all sockets in a user room except sender
function broadcastToUserRoom(userId, event, data, exceptSocket = null) {
  if (!userRooms.has(userId)) return;
  for (const socketId of userRooms.get(userId)) {
    if (socketId !== exceptSocket) {
      io.to(socketId).emit(event, data);
    }
  }
}

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join a user room to isolate their data updates
  socket.on("join_user", ({ userId }) => {
    console.log(`Socket ${socket.id} joined user room ${userId}`);
    socket.join(userId);

    // Track sockets per user
    if (!userRooms.has(userId)) userRooms.set(userId, new Set());
    userRooms.get(userId).add(socket.id);

    // Send current tab and tasks if stored (demo)
    const currentTab = userTabs.get(userId) || null;
    const tasks = userTasks.get(userId) || {};
    socket.emit("init_data", { currentTab, tasks });
  });

  // Handle tab switch
  socket.on("switch_tab", ({ userId, tabId }) => {
    userTabs.set(userId, tabId);
    console.log(`User ${userId} switched to tab ${tabId}`);

    // Broadcast to all other sockets of this user
    broadcastToUserRoom(userId, "tab_changed", { tabId }, socket.id);
  });

  // Handle task added
  socket.on("task_added", ({ userId, tabId, task }) => {
    if (!userTasks.has(userId)) userTasks.set(userId, {});
    if (!userTasks.get(userId)[tabId]) userTasks.get(userId)[tabId] = [];
    userTasks.get(userId)[tabId].push(task);
    console.log(`User ${userId} added task ${task.id} to tab ${tabId}`);

    broadcastToUserRoom(userId, "task_added", { tabId, task }, socket.id);
  });

  // Handle task deleted
  socket.on("task_deleted", ({ userId, tabId, taskId }) => {
    if (userTasks.has(userId) && userTasks.get(userId)[tabId]) {
      userTasks.set(userId, {
        ...userTasks.get(userId),
        [tabId]: userTasks.get(userId)[tabId].filter((t) => t.id !== taskId),
      });
      console.log(`User ${userId} deleted task ${taskId} from tab ${tabId}`);
    }
    broadcastToUserRoom(userId, "task_deleted", { tabId, taskId }, socket.id);
  });

  // Handle task toggled done/undone
  socket.on("task_toggled", ({ userId, tabId, taskId, isDone }) => {
    if (userTasks.has(userId) && userTasks.get(userId)[tabId]) {
      const tasks = userTasks.get(userId)[tabId];
      for (const t of tasks) {
        if (t.id === taskId) {
          t.isDone = isDone;
          break;
        }
      }
      console.log(`User ${userId} toggled task ${taskId} to ${isDone}`);
    }
    broadcastToUserRoom(userId, "task_toggled", { tabId, taskId, isDone }, socket.id);
  });

  // Handle tasks reordered
  socket.on("tasks_reordered", ({ userId, tabId, orderedTaskIds }) => {
    if (userTasks.has(userId) && userTasks.get(userId)[tabId]) {
      const tasks = userTasks.get(userId)[tabId];
      // Reorder tasks based on orderedTaskIds array
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const reordered = [];
      for (const id of orderedTaskIds) {
        if (taskMap.has(id)) reordered.push(taskMap.get(id));
      }
      userTasks.get(userId)[tabId] = reordered;
      console.log(`User ${userId} reordered tasks in tab ${tabId}`);
    }
    broadcastToUserRoom(userId, "tasks_reordered", { tabId, orderedTaskIds }, socket.id);
  });

  // On disconnect
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    for (const [userId, sockets] of userRooms.entries()) {
      sockets.delete(socket.id);
      if (sockets.size === 0) userRooms.delete(userId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
