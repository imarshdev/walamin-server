const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Allow requests from your frontend domain
    credentials: true, // Allow credentials (session cookies) to be included in requests
  },
});
app.use(
  cors({
    origin: "http://localhost:5173", // Allow requests from your frontend domain
    credentials: true, // Allow credentials (session cookies) to be included in requests
  })
);

const port = process.env.PORT || 4000;

io.on("connection", (socket) => {
  console.log("new client connected");

  socket.on("orderRide", (rideDetails) => {
    io.emit("newRide", rideDetails);
  });

  socket.on("disconnect", () => {
    console.log("client disconnected");
  });
});

server.listen(port, () => {
  console.log(`server on ${port}`);
});
