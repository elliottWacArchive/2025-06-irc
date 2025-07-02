"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function Chat() {
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [newRoomName, setNewRoomName] = useState("");
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const messagesEndRef = useRef(null);
    const router = useRouter();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("user");

        if (!token || !userData) {
            router.push("/login");
            return;
        }

        try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);

            const socketConnection = io("http://localhost:8000", {
                auth: {
                    token: token,
                },
            });

            setSocket(socketConnection);

            socketConnection.on("connect", () => {
                console.log("Connecté au serveur IRC");
                loadRooms();
            });

            socketConnection.on("connect_error", (error) => {
                console.error("Erreur de connexion:", error);
                if (
                    error.message === "Token invalide" ||
                    error.message === "Token manquant"
                ) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    router.push("/login");
                }
            });

            socketConnection.on("room-joined", (data) => {
                setCurrentRoom(data.room);
                setMessages(data.messages || []);
                setConnectedUsers(data.room.connectedUsers || []);
            });

            socketConnection.on("new-message", (message) => {
                setMessages((prev) => [...prev, message]);
            });

            socketConnection.on("command-result", (result) => {
                // Afficher le résultat de la commande comme un message système
                const commandMessage = {
                    id: Date.now().toString() + "_cmd",
                    userId: null,
                    username: "Système",
                    content: result.message,
                    timestamp: new Date(),
                    type: result.type || (result.success ? "system" : "error"),
                };
                setMessages((prev) => [...prev, commandMessage]);
            });

            socketConnection.on("user-list-updated", (data) => {
                setConnectedUsers(data.connectedUsers || []);
            });

            socketConnection.on("redirect-to-room", (data) => {
                // Rejoindre automatiquement la nouvelle salle
                joinRoom({ id: data.roomId, name: data.roomName });
            });

            socketConnection.on("room-left", (data) => {
                // Quitter la salle actuelle
                setCurrentRoom(null);
                setMessages([]);
                setConnectedUsers([]);
            });

            socketConnection.on("private-message", (pm) => {
                // Afficher le message privé reçu
                const privateMessage = {
                    id: Date.now().toString() + "_pm",
                    userId: pm.fromUserId,
                    username: pm.fromUsername,
                    content: `[Message privé] ${pm.content}`,
                    timestamp: pm.timestamp,
                    type: "private",
                    roomName: pm.roomName,
                };
                setMessages((prev) => [...prev, privateMessage]);
            });

            socketConnection.on("rooms-updated", (data) => {
                // Mettre à jour la liste des salles quand des salles sont créées/supprimées
                setRooms(data.rooms);
            });

            socketConnection.on("user-joined", (data) => {
                setConnectedUsers(data.connectedUsers || []);
            });

            socketConnection.on("user-left", (data) => {
                setConnectedUsers(data.connectedUsers || []);
            });

            socketConnection.on("error", (error) => {
                setError(error.message);
                setTimeout(() => setError(""), 5000);
            });

            return () => {
                socketConnection.disconnect();
            };
        } catch (error) {
            console.error("Erreur de parsing des données utilisateur:", error);
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.push("/login");
        }
    }, [router]);

    const loadRooms = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/api/chat/rooms", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setRooms(data.data.rooms);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des salles:", error);
        } finally {
            setLoading(false);
        }
    };

    const createRoom = async () => {
        if (!newRoomName.trim()) return;

        // Validation du nom de la salle
        const roomName = newRoomName.trim();
        if (roomName.length < 3 || roomName.length > 30) {
            setError(
                "Le nom de la salle doit contenir entre 3 et 30 caractères"
            );
            setTimeout(() => setError(""), 5000);
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
            setError(
                "Le nom de la salle ne peut contenir que des lettres, chiffres, tirets et underscores"
            );
            setTimeout(() => setError(""), 5000);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/api/chat/rooms", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: roomName }),
            });

            const data = await response.json();
            if (data.success) {
                setRooms((prev) => [...prev, data.data.room]);
                setNewRoomName("");
                setShowCreateRoom(false);
            } else {
                setError(data.message);
                setTimeout(() => setError(""), 5000);
            }
        } catch (error) {
            console.error("Erreur lors de la création de la salle:", error);
            setError("Erreur lors de la création de la salle");
            setTimeout(() => setError(""), 5000);
        }
    };

    const deleteRoom = async (roomId) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cette salle ?"))
            return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`/api/chat/rooms/${roomId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setRooms((prev) => prev.filter((room) => room.id !== roomId));
                if (currentRoom && currentRoom.id === roomId) {
                    setCurrentRoom(null);
                    setMessages([]);
                    setConnectedUsers([]);
                }
            } else {
                setError(data.message);
                setTimeout(() => setError(""), 5000);
            }
        } catch (error) {
            console.error("Erreur lors de la suppression de la salle:", error);
            setError("Erreur lors de la suppression de la salle");
            setTimeout(() => setError(""), 5000);
        }
    };

    const joinRoom = (room) => {
        if (socket && room.id !== currentRoom?.id) {
            socket.emit("join-room", { roomId: room.id });
        }
    };

    const sendMessage = () => {
        if (!socket || !currentRoom || !newMessage.trim()) return;

        socket.emit("send-message", {
            roomId: currentRoom.id,
            content: newMessage.trim(),
        });

        setNewMessage("");
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (socket) {
            socket.disconnect();
        }
        router.push("/");
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (!user || loading) {
        return (
            <div style={styles.loading}>
                <div style={styles.spinner}></div>
                <p>Chargement...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>IRC Chat</h1>
                <div style={styles.userInfo}>
                    <span style={styles.username}>{user.username}</span>
                    <button onClick={handleLogout} style={styles.logoutButton}>
                        Déconnexion
                    </button>
                </div>
            </div>

            {/* Main */}
            <div style={styles.mainContent}>
                {/* Chatlist */}
                <div style={styles.sidebar}>
                    <div style={styles.sidebarHeader}>
                        <h3>Salles de chat</h3>
                        <button
                            onClick={() => setShowCreateRoom(!showCreateRoom)}
                            style={styles.createButton}
                        >
                            +
                        </button>
                    </div>

                    {/* Form creation de salle */}
                    {showCreateRoom && (
                        <div style={styles.createRoomForm}>
                            <input
                                type="text"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="Nom de la salle (lettres, chiffres, tirets et underscores uniquement)"
                                style={styles.createRoomInput}
                                maxLength={30}
                                onKeyPress={(e) =>
                                    e.key === "Enter" && createRoom()
                                }
                            />
                            <div style={styles.createRoomButtons}>
                                <button
                                    onClick={createRoom}
                                    style={styles.createRoomSubmit}
                                >
                                    Créer
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateRoom(false);
                                        setNewRoomName("");
                                    }}
                                    style={styles.createRoomCancel}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Liste des salles */}
                    <div style={styles.roomsList}>
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                style={{
                                    ...styles.roomItem,
                                    ...(currentRoom?.id === room.id
                                        ? styles.roomItemActive
                                        : {}),
                                }}
                                onClick={() => joinRoom(room)}
                            >
                                <div style={styles.roomInfo}>
                                    <div style={styles.roomName}>
                                        {room.name}
                                    </div>
                                    <div style={styles.roomMeta}>
                                        Users {room.connectedUsersCount} •
                                        Messages {room.messagesCount}
                                    </div>
                                    <div style={styles.roomCreator}>
                                        Par {room.creatorUsername}
                                    </div>
                                </div>
                                {room.creatorId === user.id && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteRoom(room.id);
                                        }}
                                        style={styles.deleteButton}
                                    >
                                        X
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* chat */}
                <div style={styles.chatArea}>
                    {currentRoom ? (
                        <>
                            {/* header chat */}
                            <div style={styles.chatHeader}>
                                <h3>{currentRoom.name}</h3>
                                <div style={styles.connectedCount}>
                                    {connectedUsers.length} utilisateur
                                    {connectedUsers.length > 1 ? "s" : ""}{" "}
                                    connecté
                                    {connectedUsers.length > 1 ? "s" : ""}
                                </div>
                            </div>

                            {/* messages */}
                            <div style={styles.messagesContainer}>
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        style={{
                                            ...styles.message,
                                            ...(message.type === "system"
                                                ? styles.systemMessage
                                                : message.type === "error"
                                                ? styles.errorMessage
                                                : message.type === "info"
                                                ? styles.infoMessage
                                                : message.type === "private"
                                                ? styles.privateMessage
                                                : {}),
                                            ...(message.userId === user.id
                                                ? styles.ownMessage
                                                : {}),
                                        }}
                                    >
                                        {message.type !== "system" && (
                                            <div style={styles.messageHeader}>
                                                <span
                                                    style={styles.messageAuthor}
                                                >
                                                    {message.username}
                                                </span>
                                                <span
                                                    style={styles.messageTime}
                                                >
                                                    {formatTime(
                                                        message.timestamp
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        <div style={styles.messageContent}>
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Zone de saisie */}
                            <div style={styles.inputArea}>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) =>
                                        setNewMessage(e.target.value)
                                    }
                                    onKeyPress={handleKeyPress}
                                    placeholder={`Écrire dans ${currentRoom.name}... (Tapez /help pour les commandes)`}
                                    style={styles.messageInput}
                                    maxLength={1000}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!newMessage.trim()}
                                    style={styles.sendButton}
                                >
                                    Envoyer
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={styles.noRoomSelected}>
                            <h3>
                                Sélectionnez une salle pour commencer à chatter
                            </h3>
                            <p>
                                Choisissez une salle dans la liste de gauche ou
                                créez-en une nouvelle.
                            </p>
                        </div>
                    )}
                </div>

                {/* userbar */}
                {currentRoom && (
                    <div style={styles.usersSidebar}>
                        <h4>Utilisateurs connectés</h4>
                        <div style={styles.usersList}>
                            {connectedUsers.map((connectedUser) => (
                                <div
                                    key={connectedUser.id}
                                    style={styles.userItem}
                                    title={
                                        connectedUser.hasCustomNick
                                            ? `Nom original: ${connectedUser.originalUsername}`
                                            : ""
                                    }
                                >
                                    <span style={styles.userOnline}>●</span>
                                    {connectedUser.username}
                                    {connectedUser.hasCustomNick && (
                                        <span
                                            style={styles.customNickIndicator}
                                        >
                                            *
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* messages d'erreur */}
            {error && <div style={styles.errorMessage}>{error}</div>}
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
    },
    header: {
        backgroundColor: "#3b3b3b",
        backgroundImage:
            "linear-gradient(360deg, rgba(59, 59, 59, 1) 23%, rgba(179, 179, 179, 1) 100%)",
        color: "white",
        padding: "15px 20px",
        borderBottom: "1px solid black",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        margin: 0,
        color: "white",
        fontSize: "20px",
    },
    userInfo: {
        display: "flex",
        alignItems: "center",
        gap: "15px",
    },
    username: {
        fontSize: "14px",
        color: "#ddd",
    },
    logoutButton: {
        padding: "6px 12px",
        backgroundColor: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "12px",
    },
    mainContent: {
        flex: 1,
        display: "flex",
        height: "calc(100vh - 65px)",
    },
    sidebar: {
        width: "250px",
        backgroundColor: "rgb(24, 56, 111)",
        borderRight: "1px solid black",
        display: "flex",
        flexDirection: "column",
    },
    sidebarHeader: {
        padding: "15px",
        borderBottom: "1px solid black",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    createButton: {
        width: "30px",
        height: "30px",
        borderRadius: "10%",
        backgroundColor: "#007bff",
        backgroundImage:
            "linear-gradient(360deg, rgba(0, 123, 255, 1) 23%, rgba(255, 255, 255, 1) 100%)",
        color: "black",
        border: "none",
        cursor: "pointer",
        fontSize: "18px",
    },
    createRoomForm: {
        padding: "15px",
        borderBottom: "1px solid black",
        backgroundColor: "rgb(32, 77, 154)",
    },
    createRoomInput: {
        width: "100%",
        padding: "8px",
        border: "1px solid black",
        borderRadius: "4px",
        marginBottom: "10px",
    },
    createRoomButtons: {
        display: "flex",
        gap: "5px",
    },
    createRoomSubmit: {
        padding: "6px 12px",
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontSize: "12px",
    },
    createRoomCancel: {
        padding: "6px 12px",
        backgroundColor: "#6c757d",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontSize: "12px",
    },
    roomsList: {
        flex: 1,
        overflowY: "auto",
    },
    roomItem: {
        padding: "12px 15px",
        borderBottom: "1px solid black",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "background-color 0.2s",
    },
    roomItemActive: {
        backgroundColor: "rgb(0, 123, 255)",
    },
    roomInfo: {
        flex: 1,
    },
    roomName: {
        fontWeight: "bold",
        color: "#fff",
        fontSize: "14px",
        marginBottom: "4px",
    },
    roomMeta: {
        fontSize: "11px",
        color: "#ccc",
        marginBottom: "2px",
    },
    roomCreator: {
        fontSize: "10px",
        color: "#999",
    },
    deleteButton: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        borderRadius: "4px",
        fontSize: "12px",
    },
    chatArea: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgb(85, 155, 209)",
    },
    chatHeader: {
        padding: "15px 20px",
        borderBottom: "1px solid black",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    connectedCount: {
        fontSize: "12px",
        color: "rgb(52, 52, 52)",
    },
    messagesContainer: {
        flex: 1,
        overflowY: "auto",
        padding: "15px 20px",
    },
    message: {
        marginBottom: "15px",
    },
    systemMessage: {
        textAlign: "center",
        color: "#666",
        fontStyle: "italic",
        fontSize: "12px",
    },
    errorMessage: {
        textAlign: "center",
        color: "#dc3545",
        fontStyle: "italic",
        fontSize: "12px",
        backgroundColor: "#f8d7da",
        padding: "8px",
        borderRadius: "4px",
        border: "1px solid #f5c6cb",
    },
    infoMessage: {
        textAlign: "left",
        color: "#0c5460",
        fontStyle: "italic",
        fontSize: "12px",
        backgroundColor: "#d1ecf1",
        padding: "8px",
        borderRadius: "4px",
        border: "1px solid #bee5eb",
        whiteSpace: "pre-line",
    },
    ownMessage: {
        marginLeft: "20px",
    },
    messageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "4px",
    },
    messageAuthor: {
        fontWeight: "bold",
        fontSize: "13px",
        color: "green",
    },
    messageTime: {
        fontSize: "11px",
        color: "rgb(52, 52, 52)",
    },
    messageContent: {
        fontSize: "14px",
        lineHeight: "1.4",
    },
    inputArea: {
        padding: "15px 20px",
        borderTop: "1px solid black",
        display: "flex",
        gap: "10px",
    },
    messageInput: {
        flex: 1,
        padding: "10px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        fontSize: "14px",
    },
    sendButton: {
        padding: "10px 20px",
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    noRoomSelected: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "#666",
    },
    usersSidebar: {
        width: "200px",
        backgroundColor: "rgb(24, 56, 111)",
        color: "#ccc",
        borderLeft: "1px solid black",
        padding: "15px",
    },
    usersList: {
        marginTop: "10px",
    },
    userItem: {
        padding: "6px 0",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
    },
    userOnline: {
        color: "#28a745",
        fontSize: "10px",
    },
    customNickIndicator: {
        color: "#007bff",
        fontSize: "10px",
        marginLeft: "4px",
        fontWeight: "bold",
    },
    errorMessage: {
        position: "fixed",
        top: "20px",
        right: "20px",
        backgroundColor: "#f8d7da",
        color: "#721c24",
        padding: "10px 15px",
        borderRadius: "4px",
        border: "1px solid #f5c6cb",
        zIndex: 1000,
    },
    loading: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
    },
    spinner: {
        width: "40px",
        height: "40px",
        border: "4px solid #f3f3f3",
        borderTop: "4px solid #007bff",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        marginBottom: "20px",
    },
};
