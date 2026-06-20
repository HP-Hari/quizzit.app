import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/sessions/[id]/export — Export session data as CSV
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
              include: { options: true },
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        players: { orderBy: { totalScore: "desc" } },
        responses: true,
      },
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Build CSV
    const headers = ["Rank", "Player", "Total Score", "Streak"];
    const questionSlides = gameSession.quiz.slides.filter((s) => s.slideType === "QUESTION");

    // Add question headers
    questionSlides.forEach((_, i) => {
      headers.push(`Q${i + 1} Correct`, `Q${i + 1} Points`, `Q${i + 1} Time(ms)`);
    });

    const rows: string[][] = [];

    gameSession.players.forEach((player, index) => {
      const row = [
        String(index + 1),
        player.nickname,
        String(player.totalScore),
        String(player.streak),
      ];

      questionSlides.forEach((slide) => {
        const response = gameSession.responses.find(
          (r) => r.playerId === player.id && r.slideId === slide.id
        );

        if (response) {
          row.push(response.isCorrect ? "Yes" : "No");
          row.push(String(response.pointsAwarded));
          row.push(String(response.responseTimeMs));
        } else {
          row.push("N/A", "0", "N/A");
        }
      });

      rows.push(row);
    });

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="quizzit-session-${gameSession.pin}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
