const jwt = require("jsonwebtoken");

const users = [];

class User {
    constructor(username) {
        this.id = Date.now().toString();
        this.username = username;
        this.createdAt = new Date();
    }

    static create(userData) {
        const { username } = userData;

        const existingUser = users.find((u) => u.username === username);
        if (existingUser) {
            throw new Error("Utilisateur déjà existant");
        }

        const user = new User(username);
        users.push(user);

        return user;
    }

    static findByUsername(username) {
        return users.find((u) => u.username === username);
    }

    static findById(id) {
        return users.find((u) => u.id === id);
    }

    generateToken() {
        return jwt.sign(
            {
                id: this.id,
                username: this.username,
            },
            process.env.JWT_SECRET || "your-secret-key",
            { expiresIn: "24h" }
        );
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            createdAt: this.createdAt,
        };
    }

    static getAllUsers() {
        return users.map((user) => ({
            id: user.id,
            username: user.username,
            createdAt: user.createdAt,
        }));
    }
}

module.exports = User;
