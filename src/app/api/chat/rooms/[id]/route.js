import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export async function GET(request, { params }) {
    try {
        const { id } = params;
        const authHeader = request.headers.get("authorization");
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get("limit") || "50";
        const offset = searchParams.get("offset") || "0";

        const response = await fetch(
            `${API_BASE_URL}/api/chat/rooms/${id}?limit=${limit}&offset=${offset}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader || "",
                },
            }
        );

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Erreur de proxy API room detail:", error);
        return NextResponse.json(
            { success: false, message: "Erreur interne du serveur" },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = params;
        const authHeader = request.headers.get("authorization");

        const response = await fetch(`${API_BASE_URL}/api/chat/rooms/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: authHeader || "",
            },
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Erreur de proxy API delete room:", error);
        return NextResponse.json(
            { success: false, message: "Erreur interne du serveur" },
            { status: 500 }
        );
    }
}
