import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createQuizSchema } from "@/lib/validators";

// GET /api/quizzes - List user's quizzes
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const quizzes = await prisma.quiz.findMany({
      where: { creatorId: userId },
      include: {
        slides: {
          select: { id: true, slideType: true, questionType: true },
        },
        _count: {
          select: { sessions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(quizzes);
  } catch (error) {
    console.error("Get quizzes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quizzes - Create a new quiz
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();
    const validated = createQuizSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        ...validated.data,
        creatorId: userId,
      },
    });

    return NextResponse.json(quiz, { status: 201 });
  } catch (error) {
    console.error("Create quiz error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
