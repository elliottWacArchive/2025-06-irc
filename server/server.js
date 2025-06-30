const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");

const User = require("./models/User");
const { ChatRoom, UserConnections } = require("./models/ChatRoom");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.PORT || 8000;

// middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
    res.send("My IRC server is running!");
});

// middleware socket.io
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("Token manquant"));
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key",
        (err, decoded) => {
            if (err) {
                return next(new Error("Token invalide"));
            }

            const user = User.findById(decoded.id);
            if (!user) {
                return next(new Error("Utilisateur non trouvé"));
            }

            socket.userId = decoded.id;
            socket.username = decoded.username;
            next();
        }
    );
});

io.on("connection", (socket) => {
    console.log(
        "[" +
            new Date().toLocaleTimeString() +
            "][IO] User connected: " +
            socket.username +
            " (" +
            socket.id +
            ")"
    );

    UserConnections.addConnection(socket.userId, socket.id);

    socket.on("join-room", (data) => {
        try {
            const { roomId } = data;
            const room = ChatRoom.findById(roomId);

            if (!room) {
                socket.emit("error", { message: "Salle non trouvée" });
                return;
            }

            socket.rooms.forEach((roomName) => {
                if (roomName !== socket.id) {
                    socket.leave(roomName);
                }
            });

            socket.join(roomId);
            socket.currentRoomId = roomId;

            room.addUser(socket.userId, socket.username);

            io.to(roomId).emit("user-joined", {
                username: socket.username,
                userId: socket.userId,
                connectedUsers: room.getConnectedUsers(),
            });

            socket.emit("room-joined", {
                roomId,
                room: room.toJSON(),
                messages: room.getMessages(50),
            });

            console.log(
                `[${new Date().toLocaleTimeString()}][CHAT] ${
                    socket.username
                } joined room: ${room.name}`
            );
        } catch (error) {
            console.error("Erreur lors de rejoindre la salle:", error);
            socket.emit("error", {
                message: "Erreur lors de rejoindre la salle",
            });
        }
    });

    socket.on("leave-room", (data) => {
        try {
            const { roomId } = data;
            const room = ChatRoom.findById(roomId);

            if (room && socket.currentRoomId === roomId) {
                socket.leave(roomId);
                room.removeUser(socket.userId, socket.username);
                socket.currentRoomId = null;

                io.to(roomId).emit("user-left", {
                    username: socket.username,
                    userId: socket.userId,
                    connectedUsers: room.getConnectedUsers(),
                });

                console.log(
                    `[${new Date().toLocaleTimeString()}][CHAT] ${
                        socket.username
                    } left room: ${room.name}`
                );
            }
        } catch (error) {
            console.error("Erreur lors de quitter la salle:", error);
        }
    });

    socket.on("send-message", (data) => {
        try {
            const { roomId, content } = data;

            if (!content || content.trim().length === 0) {
                socket.emit("error", { message: "Message vide" });
                return;
            }

            if (content.length > 1000) {
                socket.emit("error", { message: "Message trop long" });
                return;
            }

            const room = ChatRoom.findById(roomId);
            if (!room) {
                socket.emit("error", { message: "Salle non trouvée" });
                return;
            }

            if (socket.currentRoomId !== roomId) {
                socket.emit("error", {
                    message: "Vous n'êtes pas dans cette salle",
                });
                return;
            }

            const trimmedContent = content.trim();

            // commande
            if (trimmedContent.startsWith("/")) {
                const commandResult = room.processCommand(
                    socket.userId,
                    socket.username,
                    trimmedContent
                );

                if (commandResult) {
                    socket.emit("command-result", commandResult);

                    if (commandResult.success && commandResult.newNickname) {
                        const connectedUsers = room.getConnectedUsers();
                        io.to(roomId).emit("user-list-updated", {
                            connectedUsers,
                        });
                    }

                    return;
                }
            }

            // message normal
            const message = room.addMessage(
                socket.userId,
                socket.username,
                trimmedContent
            );

            io.to(roomId).emit("new-message", message);

            console.log(
                `[${new Date().toLocaleTimeString()}][CHAT] ${
                    socket.username
                } in ${room.name}: ${content.substring(0, 50)}${
                    content.length > 50 ? "..." : ""
                }`
            );
        } catch (error) {
            console.error("Erreur lors de l'envoi du message:", error);
            socket.emit("error", {
                message: "Erreur lors de l'envoi du message",
            });
        }
    });

    socket.on("disconnect", () => {
        console.log(
            "[" +
                new Date().toLocaleTimeString() +
                "][IO] User disconnected: " +
                socket.username +
                " (" +
                socket.id +
                ")"
        );

        if (socket.currentRoomId) {
            const room = ChatRoom.findById(socket.currentRoomId);
            if (room) {
                room.removeUser(socket.userId, socket.username);

                io.to(socket.currentRoomId).emit("user-left", {
                    username: socket.username,
                    userId: socket.userId,
                    connectedUsers: room.getConnectedUsers(),
                });
            }
        }

        UserConnections.removeConnection(socket.userId, socket.id);
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
