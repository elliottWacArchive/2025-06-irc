const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const validateUsername = (username) => {
    const validUsernameRegex = /^[a-zA-Z0-9_-]+$/;
    return (
        username &&
        username.length >= 3 &&
        username.length <= 20 &&
        validUsernameRegex.test(username)
    );
};

router.post("/register", async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Le nom d'utilisateur est requis",
            });
        }

        if (!validateUsername(username)) {
            return res.status(400).json({
                success: false,
                message:
                    "Le nom d'utilisateur doit contenir entre 3 et 20 caractères et ne peut contenir que des lettres, chiffres, tirets et underscores",
            });
        }

        const user = User.create({ username });

        const token = user.generateToken();

        res.status(201).json({
            success: true,
            message: "Utilisateur créé avec succès",
            data: {
                user: user.toJSON(),
                token,
            },
        });
    } catch (error) {
        console.error("Erreur lors de l'inscription:", error);

        if (error.message === "Utilisateur déjà existant") {
            return res.status(409).json({
                success: false,
                message: "Un utilisateur avec ce nom d'utilisateur existe déjà",
            });
        }

        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Nom d'utilisateur requis",
            });
        }

        if (!validateUsername(username)) {
            return res.status(400).json({
                success: false,
                message:
                    "Le nom d'utilisateur doit contenir entre 3 et 20 caractères et ne peut contenir que des lettres, chiffres, tirets et underscores",
            });
        }

        let user = User.findByUsername(username);

        if (!user) {
            user = User.create({ username });
        }

        const token = user.generateToken();

        res.json({
            success: true,
            message: "Connexion réussie",
            data: {
                user: user.toJSON(),
                token,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la connexion:", error);

        if (error.message === "Utilisateur déjà existant") {
            return res.status(409).json({
                success: false,
                message: "Un utilisateur avec ce nom d'utilisateur existe déjà",
            });
        }

        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.get("/profile", authenticateToken, (req, res) => {
    try {
        const user = User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé",
            });
        }

        res.json({
            success: true,
            data: {
                user: user.toJSON(),
            },
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du profil:", error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

router.post("/verify-token", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "Token valide",
        data: {
            user: req.user,
        },
    });
});

router.post("/logout", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "Déconnexion réussie",
    });
});

router.get("/users", authenticateToken, (req, res) => {
    try {
        const users = User.getAllUsers();
        res.json({
            success: true,
            data: {
                users,
            },
        });
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des utilisateurs:",
            error
        );
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

module.exports = router;
