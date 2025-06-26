import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export async function POST(request) {
    try {
        const body = await request.json();

        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Erreur de proxy API login:", error);
        return NextResponse.json(
            { success: false, message: "Erreur interne du serveur" },
            { status: 500 }
        );
    }
}
