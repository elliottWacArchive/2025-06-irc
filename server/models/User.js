const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const users = [];

class User {
    constructor(username, password) {
        this.id = Date.now().toString();
        this.username = username;
        this.password = password;
        this.createdAt = new Date();
    }

    static async create(userData) {
        const { username, password } = userData;

        const existingUser = users.find((u) => u.username === username);
        if (existingUser) {
            throw new Error("Utilisateur déjà existant");
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = new User(username, hashedPassword);
        users.push(user);

        return user;
    }

    static findByUsername(username) {
        return users.find((u) => u.username === username);
    }

    static findById(id) {
        return users.find((u) => u.id === id);
    }

    async comparePassword(password) {
        return await bcrypt.compare(password, this.password);
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
