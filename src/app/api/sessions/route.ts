import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSessionSchema } from "@/lib/validators";
import { generatePin } from "@/lib/utils";

// GET /api/sessions - List host's sessions
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const sessions = await prisma.gameSession.findMany({
      where: { hostId: userId },
      include: {
        quiz: { select: { id: true, title: true } },
        _count: { select: { players: true, responses: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sessions - Create a new game session
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();
    const validated = createSessionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify quiz exists and belongs to user
    const quiz = await prisma.quiz.findUnique({
      where: { id: validated.data.quizId },
      include: { slides: true },
    });

    if (!quiz || quiz.creatorId !== userId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (quiz.slides.length === 0) {
      return NextResponse.json(
        { error: "Quiz must have at least one slide" },
        { status: 400 }
      );
    }

    // Generate unique PIN
    let pin: string;
    let pinExists = true;
    do {
      pin = generatePin();
      const existing = await prisma.gameSession.findUnique({ where: { pin } });
      pinExists = !!existing;
    } while (pinExists);

    const gameSession = await prisma.gameSession.create({
      data: {
        quizId: validated.data.quizId,
        hostId: userId,
        pin,
        teamMode: validated.data.teamMode,
        teamCount: validated.data.teamCount,
      },
    });

    return NextResponse.json(gameSession, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
