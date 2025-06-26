const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const validatePassword = (password) => {
    return password && password.length >= 6;
};

const validateUsername = (username) => {
    return username && username.length >= 3 && username.length <= 20;
};

router.post("/register", async (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;

        if (!username || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Tous les champs sont requis",
            });
        }

        if (!validateUsername(username)) {
            return res.status(400).json({
                success: false,
                message:
                    "Le nom d'utilisateur doit contenir entre 3 et 20 caractères",
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Le mot de passe doit contenir au moins 6 caractères",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Les mots de passe ne correspondent pas",
            });
        }

        const user = await User.create({ username, password });

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
        const { username, password } = req.body;

        // Validation des champs requis
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Nom d'utilisateur et mot de passe requis",
            });
        }

        // Rechercher l'utilisateur par nom d'utilisateur
        const user = User.findByUsername(username);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Identifiants invalides",
            });
        }

        // Vérifier le mot de passe
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Identifiants invalides",
            });
        }

        // Générer le token JWT
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
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur",
        });
    }
});

// Route pour obtenir le profil utilisateur (nécessite l'authentification)
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

// Route pour vérifier la validité du token
router.post("/verify-token", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "Token valide",
        data: {
            user: req.user,
        },
    });
});

// Route pour se déconnecter (côté client seulement, suppression du token)
router.post("/logout", authenticateToken, (req, res) => {
    // Dans une vraie application, vous pourriez maintenir une liste noire des tokens
    res.json({
        success: true,
        message: "Déconnexion réussie",
    });
});

// Route pour obtenir tous les utilisateurs (pour le chat)
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
