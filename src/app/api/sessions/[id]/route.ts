import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/sessions/[id] - Get session details with analytics
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gameSession = await prisma.gameSession.findUnique({
      where: { id },
      include: {
        quiz: {
          include: {
            slides: {
              include: { options: { orderBy: { orderIndex: "asc" } } },
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        players: {
          orderBy: { totalScore: "desc" },
          include: { team: true },
        },
        teams: true,
        responses: true,
      },
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(gameSession);
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
