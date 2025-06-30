const express = require("express");
const { ChatRoom } = require("../models/ChatRoom");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.post("/rooms", authenticateToken, (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Le nom de la salle est requis",
            });
        }

        if (name.length > 50) {
            return res.status(400).json({
                success: false,
                message:
                    "Le nom de la salle ne peut pas dépasser 50 caractères",
            });
        }

        const room = ChatRoom.create({
            name: name.trim(),
            creatorId: req.user.id,
            creatorUsername: req.user.username,
        });

        res.status(201).json({
            success: true,
            message: "Salle créée avec succès",
            data: {
                room: room.toJSON(),
            },
        });
    } catch (error) {
        console.error("Erreur lors de la création de la salle:", error);

        if (error.message === "Une salle avec ce nom existe déjà") {
            return res.status(409).json({
                success: false,
                message: error.message,
            });
        }

        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.get("/rooms", authenticateToken, (req, res) => {
    try {
        const rooms = ChatRoom.getAllRooms();

        res.json({
            success: true,
            data: {
                rooms,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des salles:", error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.get("/rooms/:id", authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const room = ChatRoom.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Salle non trouvée",
            });
        }

        const messages = room.getMessages(parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            data: {
                room: room.toJSON(),
                messages,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de la salle:", error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.delete("/rooms/:id", authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const deletedRoom = ChatRoom.deleteById(id, req.user.id);

        res.json({
            success: true,
            message: "Salle supprimée avec succès",
            data: {
                room: deletedRoom.toJSON(),
            },
        });
    } catch (error) {
        console.error("Erreur lors de la suppression de la salle:", error);

        if (error.message === "Salle non trouvée") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        if (error.message === "Seul le créateur peut supprimer cette salle") {
            return res.status(403).json({
                success: false,
                message: error.message,
            });
        }

        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.get("/rooms/:id/messages", authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const room = ChatRoom.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Salle non trouvée",
            });
        }

        const messages = room.getMessages(parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            data: {
                messages,
                total: room.messages.length,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des messages:", error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

module.exports = router;
