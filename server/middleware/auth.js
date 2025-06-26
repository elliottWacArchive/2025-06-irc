const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Token d'accès requis",
        });
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key",
        (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: "Token invalide ou expiré",
                });
            }

            const user = User.findById(decoded.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Utilisateur non trouvé",
                });
            }

            req.user = decoded;
            next();
        }
    );
};

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key",
        (err, decoded) => {
            if (err) {
                req.user = null;
            } else {
                const user = User.findById(decoded.id);
                req.user = user ? decoded : null;
            }
            next();
        }
    );
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentification requise",
            });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Permissions insuffisantes",
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
};
