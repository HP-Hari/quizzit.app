import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSlideSchema } from "@/lib/validators";

// GET /api/quizzes/[id]/slides
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

    const slides = await prisma.slide.findMany({
      where: { quizId: id },
      include: { options: { orderBy: { orderIndex: "asc" } } },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json(slides);
  } catch (error) {
    console.error("Get slides error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/quizzes/[id]/slides
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz || quiz.creatorId !== userId) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const validated = createSlideSchema.safeParse({ ...body, quizId: id });

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { options, ...slideData } = validated.data;

    const slide = await prisma.slide.create({
      data: {
        ...slideData,
        options: {
          create: options.map((opt) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            orderIndex: opt.orderIndex,
            mediaUrl: opt.mediaUrl || undefined,
          })),
        },
      },
      include: { options: true },
    });

    return NextResponse.json(slide, { status: 201 });
  } catch (error) {
    console.error("Create slide error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
