import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT /api/quizzes/[id]/slides/bulk — Replace all slides atomically
export async function PUT(
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
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: { slides: { select: { id: true } } },
    });

    if (!quiz || quiz.creatorId !== userId) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const { slides } = body as {
      slides: {
        orderIndex: number;
        slideType: string;
        title?: string;
        bodyMarkdown?: string;
        questionText?: string;
        questionType?: string;
        timeLimitSec?: number;
        pointsBase?: number;
        codeSnippet?: string;
        codeLanguage?: string;
        mediaUrl?: string;
        options?: { text: string; isCorrect: boolean; orderIndex: number; mediaUrl?: string }[];
      }[];
    };

    if (!Array.isArray(slides)) {
      return NextResponse.json({ error: "slides must be an array" }, { status: 400 });
    }

    // Use transaction to ensure all slide updates are atomic
    const createdSlides = await prisma.$transaction(async (tx) => {
      // Delete all existing options for this quiz's slides
      const existingSlideIds = quiz.slides.map((s) => s.id);
      if (existingSlideIds.length > 0) {
        await tx.questionOption.deleteMany({
          where: { slideId: { in: existingSlideIds } },
        });
        // Delete all existing slides
        await tx.slide.deleteMany({
          where: { quizId: id },
        });
      }

      // Create all new slides with options
      const tempSlides = [];
      for (const slide of slides) {
        const { options, ...slideData } = slide;
        const created = await tx.slide.create({
          data: {
            quizId: id,
            orderIndex: slideData.orderIndex,
            slideType: slideData.slideType,
            title: slideData.title || null,
            bodyMarkdown: slideData.bodyMarkdown || null,
            questionText: slideData.questionText || null,
            questionType: slideData.questionType || null,
            timeLimitSec: slideData.timeLimitSec ?? 30,
            pointsBase: slideData.pointsBase ?? 1000,
            codeSnippet: slideData.codeSnippet || null,
            codeLanguage: slideData.codeLanguage || null,
            mediaUrl: slideData.mediaUrl || null,
            options: {
              create: (options || []).map((opt) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                orderIndex: opt.orderIndex,
                mediaUrl: opt.mediaUrl || undefined,
              })),
            },
          },
          include: { options: true },
        });
        tempSlides.push(created);
      }

      // Mark quiz as not draft if it has slides
      if (slides.length > 0) {
        await tx.quiz.update({
          where: { id },
          data: { isDraft: false },
        });
      }

      return tempSlides;
    });

    return NextResponse.json({ slides: createdSlides, count: createdSlides.length });
  } catch (error) {
    console.error("Bulk save slides error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
