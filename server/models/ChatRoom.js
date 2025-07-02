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
        this.lastActivity = new Date();
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
            lastActivity: room.lastActivity,
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

    static cleanupInactiveRooms() {
        const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
        const now = new Date();
        const roomsToDelete = [];

        chatRooms.forEach((room) => {
            const timeSinceLastActivity = now - room.lastActivity;
            if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
                roomsToDelete.push(room);
            }
        });

        roomsToDelete.forEach((room) => {
            console.log(`Auto-suppression de la salle inactive: ${room.name}`);

            room.addSystemMessage(
                `Cette salle sera supprimée automatiquement pour inactivité`
            );

            const roomIndex = chatRooms.findIndex((r) => r.id === room.id);
            if (roomIndex !== -1) {
                chatRooms.splice(roomIndex, 1);
            }
        });

        return roomsToDelete;
    }

    static startAutoCleanup() {
        setInterval(() => {
            ChatRoom.cleanupInactiveRooms();
        }, 60 * 1000);
    }

    static getInactiveRooms() {
        const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
        const now = new Date();

        return chatRooms
            .filter((room) => {
                const timeSinceLastActivity = now - room.lastActivity;
                return timeSinceLastActivity > INACTIVITY_TIMEOUT;
            })
            .map((room) => ({
                id: room.id,
                name: room.name,
                lastActivity: room.lastActivity,
                minutesInactive: Math.round((now - room.lastActivity) / 60000),
            }));
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
        this.lastActivity = new Date();

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
            lastActivity: this.lastActivity,
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
            case "/list":
                return this.handleListCommand(args);
            case "/create":
                return this.handleCreateCommand(userId, originalUsername, args);
            case "/delete":
                return this.handleDeleteCommand(userId, args);
            case "/leave":
                return this.handleLeaveCommand(userId, originalUsername, args);
            case "/users":
                return this.handleUsersCommand();
            case "/msg":
                return this.handleMsgCommand(userId, originalUsername, args);
            case "/inactive":
                return this.handleInactiveCommand();
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
            • /list [filtre] : Lister les salles disponibles (optionnel: filtrer par nom)
            • /create <nom> : Créer une nouvelle salle
            • /delete <nom> : Supprimer une salle (créateur uniquement)
            • /leave : Quitter la salle actuelle
            • /users : Lister les utilisateurs dans la salle actuelle
            • /msg <nom> <message> : Envoyer un message privé
            • /inactive : Voir les salles inactives (suppression auto après 5min d'inactivité)
            • /help : Afficher cette aide
        `.trim();

        return {
            success: true,
            message: helpText,
            type: "info",
        };
    }

    handleListCommand(args) {
        const filter =
            args.length > 1 ? args.slice(1).join(" ").toLowerCase() : "";
        const allRooms = ChatRoom.getAllRooms();

        let filteredRooms = allRooms;
        if (filter) {
            filteredRooms = allRooms.filter((room) =>
                room.name.toLowerCase().includes(filter)
            );
        }

        if (filteredRooms.length === 0) {
            const message = filter
                ? `Aucune salle trouvée contenant "${filter}"`
                : "Aucune salle disponible";
            return {
                success: true,
                message,
                type: "info",
            };
        }

        const roomList = filteredRooms
            .map(
                (room) =>
                    `• ${room.name} (${room.connectedUsersCount} utilisateurs)`
            )
            .join("\n");

        const title = filter
            ? `Salles contenant "${filter}" :`
            : "Salles disponibles :";

        return {
            success: true,
            message: `${title}\n${roomList}`,
            type: "info",
        };
    }

    handleCreateCommand(userId, originalUsername, args) {
        if (args.length < 2) {
            return {
                success: false,
                message: "Usage: /create <nom_de_la_salle>",
                type: "error",
            };
        }

        const roomName = args[1];

        try {
            const newRoom = ChatRoom.create({
                name: roomName,
                creatorId: userId,
                creatorUsername: originalUsername,
            });

            return {
                success: true,
                message: `Salle "${roomName}" créée avec succès. ID: ${newRoom.id}`,
                type: "success",
                roomCreated: {
                    id: newRoom.id,
                    name: newRoom.name,
                },
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                type: "error",
            };
        }
    }

    handleDeleteCommand(userId, args) {
        if (args.length < 2) {
            return {
                success: false,
                message: "Usage: /delete <nom_de_la_salle>",
                type: "error",
            };
        }

        const roomName = args[1];

        try {
            const roomToDelete = chatRooms.find(
                (room) => room.name.toLowerCase() === roomName.toLowerCase()
            );

            if (!roomToDelete) {
                return {
                    success: false,
                    message: `Salle "${roomName}" non trouvée`,
                    type: "error",
                };
            }

            const deletedRoom = ChatRoom.deleteById(roomToDelete.id, userId);

            return {
                success: true,
                message: `Salle "${deletedRoom.name}" supprimée avec succès`,
                type: "success",
                roomDeleted: {
                    id: deletedRoom.id,
                    name: deletedRoom.name,
                },
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                type: "error",
            };
        }
    }

    handleLeaveCommand(userId, originalUsername, args) {
        return {
            success: true,
            message: "Vous avez quitté la salle",
            type: "success",
            leaveRoom: true,
        };
    }

    handleUsersCommand() {
        const users = this.getConnectedUsers();

        if (users.length === 0) {
            return {
                success: true,
                message: "Aucun utilisateur dans cette salle",
                type: "info",
            };
        }

        const userList = users
            .map((user) => {
                const indicator = user.hasCustomNick ? "★" : "";
                return `• ${user.username}${indicator}`;
            })
            .join("\n");

        return {
            success: true,
            message: `Utilisateurs dans cette salle (${users.length}) :\n${userList}\n\n★ = nom personnalisé`,
            type: "info",
        };
    }

    handleMsgCommand(userId, originalUsername, args) {
        if (args.length < 3) {
            return {
                success: false,
                message: "Usage: /msg <nom_utilisateur> <message>",
                type: "error",
            };
        }

        const targetUsername = args[1];
        const message = args.slice(2).join(" ");

        const targetUser = this.findUserByDisplayName(targetUsername);

        if (!targetUser) {
            return {
                success: false,
                message: `Utilisateur "${targetUsername}" non trouvé dans cette salle`,
                type: "error",
            };
        }

        if (targetUser.id === userId) {
            return {
                success: false,
                message:
                    "Vous ne pouvez pas vous envoyer un message privé à vous-même",
                type: "error",
            };
        }

        const senderDisplayName = this.getUserDisplayName(
            userId,
            originalUsername
        );

        return {
            success: true,
            message: `Message privé envoyé à ${targetUsername}`,
            type: "success",
            privateMessage: {
                fromUserId: userId,
                fromUsername: senderDisplayName,
                toUserId: targetUser.id,
                toUsername: targetUsername,
                content: message,
            },
        };
    }

    handleInactiveCommand() {
        const inactiveRooms = ChatRoom.getInactiveRooms();

        if (inactiveRooms.length === 0) {
            return {
                success: true,
                message: "Aucune salle inactive trouvée",
                type: "info",
            };
        }

        const roomList = inactiveRooms
            .map(
                (room) =>
                    `• ${room.name} (inactive depuis ${room.minutesInactive} minutes)`
            )
            .join("\n");

        return {
            success: true,
            message: `Salles inactives (suppression automatique après 5 minutes) :\n${roomList}`,
            type: "info",
        };
    }

    // Méthodes utilitaires pour la gestion des pseudonymes
    getUserDisplayName(userId, originalUsername) {
        const userData = this.userNicknames.get(userId);
        return userData && userData.customNickname
            ? userData.customNickname
            : originalUsername;
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
                userData.customNickname &&
                userData.customNickname.toLowerCase() === nickname.toLowerCase()
            ) {
                return true;
            }
        }
        return false;
    }

    findUserByDisplayName(displayName) {
        const User = require("./User");

        for (const userId of this.connectedUsers) {
            const user = User.findById(userId);
            if (user) {
                const userDisplayName = this.getUserDisplayName(
                    userId,
                    user.username
                );
                if (
                    userDisplayName.toLowerCase() === displayName.toLowerCase()
                ) {
                    return {
                        id: user.id,
                        username: userDisplayName,
                        originalUsername: user.username,
                    };
                }
            }
        }
        return null;
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

    getConnectionsForUser(userId) {
        if (userConnections.has(userId)) {
            return Array.from(userConnections.get(userId));
        }
        return [];
    },
};

module.exports = { ChatRoom, UserConnections };

ChatRoom.startAutoCleanup();
