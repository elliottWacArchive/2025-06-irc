"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [formData, setFormData] = useState({
        username: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [validationError, setValidationError] = useState("");
    const router = useRouter();

    const validateUsername = (username) => {
        if (!username) {
            return "";
        }
        if (username.length < 3) {
            return "Le nom d'utilisateur doit contenir au moins 3 caractères";
        }
        if (username.length > 20) {
            return "Le nom d'utilisateur ne peut pas dépasser 20 caractères";
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores";
        }
        return "";
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        if (name === "username") {
            const validationErr = validateUsername(value);
            setValidationError(validationErr);
        }

        if (error) setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErr = validateUsername(formData.username);
        if (validationErr) {
            setValidationError(validationErr);
            return;
        }

        setLoading(true);
        setError("");
        setValidationError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem("token", data.data.token);
                localStorage.setItem("user", JSON.stringify(data.data.user));

                router.push("/chat");
            } else {
                setError(data.message || "Erreur de connexion");
            }
        } catch (err) {
            setError("Erreur de connexion au serveur");
            console.error("Erreur de connexion:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.formContainer}>
                <h1 style={styles.title}>Connexion IRC</h1>
                <p style={styles.subtitle}>
                    Entrez votre nom d'utilisateur pour accéder au chat
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label htmlFor="username" style={styles.label}>
                            Nom d'utilisateur
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            required
                            style={{
                                ...styles.input,
                                ...(validationError ? styles.inputError : {}),
                            }}
                            placeholder="Entrez votre nom d'utilisateur (lettres, chiffres, tirets et underscores uniquement)"
                        />
                        {validationError && (
                            <span style={styles.fieldError}>
                                {validationError}
                            </span>
                        )}
                    </div>

                    {error && <div style={styles.error}>{error}</div>}

                    <button
                        type="submit"
                        disabled={loading || validationError}
                        style={styles.button}
                    >
                        {loading ? "Connexion..." : "Se connecter"}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgb(43, 112, 168)",
        padding: "20px",
    },
    formContainer: {
        padding: "40px",
        width: "100%",
        maxWidth: "400px",
    },
    title: {
        textAlign: "center",
        marginBottom: "10px",
        fontSize: "24px",
        fontWeight: "bold",
        color: "#ccc",
    },
    subtitle: {
        textAlign: "center",
        marginBottom: "30px",
        fontSize: "14px",
        color: "#ccc",
        fontStyle: "italic",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "5px",
    },
    label: {
        fontSize: "14px",
        fontWeight: "500",
        color: "#ccc",
    },
    input: {
        padding: "12px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#ddd",
        borderRadius: "4px",
        fontSize: "16px",
        outline: "none",
    },
    inputError: {
        borderColor: "#dc3545",
    },
    fieldError: {
        color: "#dc3545",
        fontSize: "12px",
        marginTop: "2px",
    },
    button: {
        padding: "12px",
        backgroundColor: "#007bff",
        backgroundImage:
            "linear-gradient(360deg, rgba(0, 123, 255, 1) 23%, rgba(255, 255, 255, 1) 100%)",
        color: "black",
        border: "none",
        borderRadius: "4px",
        fontSize: "16px",
        fontWeight: "500",
        cursor: "pointer",
        transition: "background-color 0.3s ease",
        marginTop: "10px",
    },
    error: {
        backgroundColor: "#f8d7da",
        color: "#721c24",
        padding: "10px",
        borderRadius: "4px",
        border: "1px solid #f5c6cb",
        fontSize: "14px",
    },
    linkContainer: {
        textAlign: "center",
        marginTop: "20px",
    },
    linkText: {
        color: "#666",
        fontSize: "14px",
    },
    link: {
        color: "#007bff",
        textDecoration: "none",
        fontWeight: "500",
    },
};
