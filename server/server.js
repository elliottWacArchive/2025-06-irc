const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("My IRC server is running!");
});

io.on("connection", (socket) => {
    console.log(
        "[" +
            new Date().toLocaleTimeString() +
            "][IO] User connected: " +
            socket.id
    );

    socket.on("message", (data) => {
        console.log(
            "[" + new Date().toLocaleTimeString() + "][IO] Message emit:",
            data
        );
    });

    socket.on("disconnect", () => {
        console.log(
            "[" +
                new Date().toLocaleTimeString() +
                "][IO] User disconnected: " +
                socket.id
        );
    });
});

server.listen(PORT, () => {
    console.log(
        "[" +
            new Date().toLocaleTimeString() +
            `][Express] Server started: http://localhost:${PORT}`
    );
});

module.exports = { app, server, io };
