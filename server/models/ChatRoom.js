const chatRooms = [];
const userConnections = new Map();

class ChatRoom {
    constructor(name, creatorId, creatorUsername) {
        this.id = Date.now().toString();
        this.name = name;
        this.creatorId = creatorId;
        this.creatorUsername = creatorUsername;
        this.messages = [];
        this.connectedUsers = new Set();
        this.createdAt = new Date();
        this.userNicknames = new Map();
    }

    static create(data) {
        const { name, creatorId, creatorUsername } = data;

        if (!ChatRoom.isValidRoomName(name)) {
            throw new Error(
                "Le nom de la salle ne peut contenir que des lettres, chiffres, tirets et underscores"
            );
        }

        const existingRoom = chatRooms.find(
            (room) => room.name.toLowerCase() === name.toLowerCase()
        );

        if (existingRoom) {
            throw new Error("Une salle avec ce nom existe déjà");
        }

        const room = new ChatRoom(name, creatorId, creatorUsername);
        chatRooms.push(room);
        return room;
    }

    static isValidRoomName(name) {
        const validNameRegex = /^[a-zA-Z0-9_-]+$/;
        return (
            name &&
            name.length >= 3 &&
            name.length <= 30 &&
            validNameRegex.test(name)
        );
    }

    static getAllRooms() {
        return chatRooms.map((room) => ({
            id: room.id,
            name: room.name,
            creatorId: room.creatorId,
            creatorUsername: room.creatorUsername,
            connectedUsersCount: room.connectedUsers.size,
            messagesCount: room.messages.length,
            createdAt: room.createdAt,
        }));
    }

    static findById(id) {
        return chatRooms.find((room) => room.id === id);
    }

    static deleteById(id, userId) {
        const roomIndex = chatRooms.findIndex((room) => room.id === id);
        if (roomIndex === -1) {
            throw new Error("Salle non trouvée");
        }

        const room = chatRooms[roomIndex];
        if (room.creatorId !== userId) {
            throw new Error("Seul le créateur peut supprimer cette salle");
        }

        chatRooms.splice(roomIndex, 1);
        return room;
    }

    addUser(userId, username) {
        this.connectedUsers.add(userId);

        if (!this.userNicknames.has(userId)) {
            this.userNicknames.set(userId, {
                originalUsername: username,
                customNickname: null,
                joinTime: new Date(),
            });
        }

        this.addSystemMessage(`${username} a rejoint la salle`);
    }

    removeUser(userId, username) {
        this.connectedUsers.delete(userId);

        this.userNicknames.delete(userId);

        if (username) {
            this.addSystemMessage(`${username} a quitté la salle`);
        }
    }

    addMessage(userId, username, content) {
        const displayName = this.getUserDisplayName(userId, username);

        const message = {
            id: Date.now().toString(),
            userId,
            username: displayName,
            originalUsername: username,
            content,
            timestamp: new Date(),
            type: "user",
        };

        this.messages.push(message);

        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }

        return message;
    }

    addSystemMessage(content) {
        const message = {
            id: Date.now().toString(),
            userId: null,
            username: "Système",
            content,
            timestamp: new Date(),
            type: "system",
        };

        this.messages.push(message);
        return message;
    }

    getConnectedUsers() {
        const User = require("./User");
        const users = [];

        for (const userId of this.connectedUsers) {
            const user = User.findById(userId);
            if (user) {
                const displayName = this.getUserDisplayName(
                    userId,
                    user.username
                );
                users.push({
                    id: user.id,
                    username: displayName,
                    originalUsername: user.username,
                    hasCustomNick:
                        this.userNicknames.has(userId) &&
                        this.userNicknames.get(userId).customNickname !== null,
                });
            }
        }

        return users;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            creatorId: this.creatorId,
            creatorUsername: this.creatorUsername,
            connectedUsers: this.getConnectedUsers(),
            connectedUsersCount: this.connectedUsers.size,
            messagesCount: this.messages.length,
            createdAt: this.createdAt,
        };
    }

    getMessages(limit = 50, offset = 0) {
        const start = Math.max(0, this.messages.length - limit - offset);
        const end = this.messages.length - offset;

        return this.messages.slice(start, end);
    }

    // commandes du chat
    processCommand(userId, originalUsername, content) {
        const trimmedContent = content.trim();

        if (!trimmedContent.startsWith("/")) {
            return null;
        }

        const args = trimmedContent.split(" ");
        const command = args[0].toLowerCase();

        switch (command) {
            case "/nick":
                return this.handleNickCommand(userId, originalUsername, args);
            case "/help":
                return this.handleHelpCommand();
            default:
                return {
                    success: false,
                    message: `Commande inconnue: ${command}. Tapez /help pour voir les commandes disponibles.`,
                    type: "error",
                };
        }
    }

    handleNickCommand(userId, originalUsername, args) {
        if (args.length < 2) {
            return {
                success: false,
                message: "Usage: /nick <nouveau_nom>",
                type: "error",
            };
        }

        const newNickname = args[1];

        if (!this.isValidNickname(newNickname)) {
            return {
                success: false,
                message:
                    "Le nom doit contenir entre 3 et 20 caractères et ne peut contenir que des lettres, chiffres, tirets et underscores",
                type: "error",
            };
        }

        if (this.isNicknameInUse(newNickname, userId)) {
            return {
                success: false,
                message: `Le nom "${newNickname}" est déjà utilisé dans cette salle`,
                type: "error",
            };
        }

        const oldDisplayName = this.getUserDisplayName(
            userId,
            originalUsername
        );

        this.userNicknames.set(userId, {
            originalUsername,
            customNickname: newNickname,
            changedAt: new Date(),
        });

        this.addSystemMessage(
            `${oldDisplayName} a changé son nom en ${newNickname}`
        );

        return {
            success: true,
            message: `Votre nom a été changé en "${newNickname}"`,
            type: "success",
            newNickname: newNickname,
        };
    }

    handleHelpCommand() {
        const helpText = `
Commandes disponibles :
• /nick <nom> : Changer votre nom dans cette salle
• /help : Afficher cette aide
        `.trim();

        return {
            success: true,
            message: helpText,
            type: "info",
        };
    }

    isValidNickname(nickname) {
        const validNameRegex = /^[a-zA-Z0-9_-]+$/;
        return (
            nickname &&
            nickname.length >= 3 &&
            nickname.length <= 20 &&
            validNameRegex.test(nickname)
        );
    }

    isNicknameInUse(nickname, excludeUserId = null) {
        for (const [userId, userData] of this.userNicknames.entries()) {
            if (
                userId !== excludeUserId &&
                userData.customNickname.toLowerCase() === nickname.toLowerCase()
            ) {
                return true;
            }
        }
        return false;
    }

    getUserDisplayName(userId, originalUsername) {
        const userData = this.userNicknames.get(userId);
        return userData && userData.customNickname
            ? userData.customNickname
            : originalUsername;
    }
}

const UserConnections = {
    addConnection(userId, socketId) {
        if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(socketId);
    },

    removeConnection(userId, socketId) {
        if (userConnections.has(userId)) {
            userConnections.get(userId).delete(socketId);
            if (userConnections.get(userId).size === 0) {
                userConnections.delete(userId);
            }
        }
    },

    isUserConnected(userId) {
        return (
            userConnections.has(userId) && userConnections.get(userId).size > 0
        );
    },

    getConnectedUsers() {
        return Array.from(userConnections.keys());
    },
};

module.exports = { ChatRoom, UserConnections };
