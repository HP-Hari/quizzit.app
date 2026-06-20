import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE /api/quizzes/[id]/slides/[slideId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  try {
    const { id, slideId } = await params;
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

    // Verify slide belongs to quiz
    const slide = await prisma.slide.findFirst({
      where: { id: slideId, quizId: id },
    });

    if (!slide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Delete options first (cascade), then the slide atomically in a transaction
    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { slideId } }),
      prisma.slide.delete({ where: { id: slideId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete slide error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
