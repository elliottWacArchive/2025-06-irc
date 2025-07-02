"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            router.push("/chat");
        }
    }, [router]);

    return (
        <div style={styles.container}>
            {/* <div style={styles.content}> */}
            <h1 style={styles.title}>My IRC</h1>
            <p style={styles.description}>Discussion anonyme en temp réel.</p>

            <div style={styles.buttonContainer}>
                <Link href="/login" style={styles.button}>
                    Se connecter
                </Link>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgb(43, 112, 168)",
        padding: "20px",
    },
    title: {
        fontSize: "36px",
        fontWeight: "bold",
        color: "#ccc",
        marginBottom: "20px",
    },
    description: {
        fontSize: "18px",
        color: "#ccc",
        marginBottom: "30px",
        lineHeight: "1.6",
    },
    buttonContainer: {
        display: "flex",
        gap: "15px",
        justifyContent: "center",
        marginBottom: "40px",
        flexWrap: "wrap",
    },
    button: {
        display: "inline-block",
        padding: "12px 30px",
        backgroundColor: "#007bff",
        backgroundImage:
            "linear-gradient(360deg, rgba(0, 123, 255, 1) 23%, rgba(255, 255, 255, 1) 100%)",
        color: "black",
        textDecoration: "none",
        borderRadius: "5px",
        fontWeight: "500",
        transition: "background-color 0.3s ease",
        cursor: "pointer",
    },
};
