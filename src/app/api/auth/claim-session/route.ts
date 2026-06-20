import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { claimSessionSchema } from "@/lib/validators";

// POST /api/auth/claim-session — Guest converts to registered user & links session data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = claimSessionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, sessionPlayerId } = validated.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    // Verify the session player exists and doesn't already have a userId
    const sessionPlayer = await prisma.sessionPlayer.findUnique({
      where: { id: sessionPlayerId },
    });

    if (!sessionPlayer) {
      return NextResponse.json(
        { error: "Session player not found" },
        { status: 404 }
      );
    }

    if (sessionPlayer.userId) {
      return NextResponse.json(
        { error: "This session is already linked to an account" },
        { status: 400 }
      );
    }

    // Create user and link session player inside a transaction
    const user = await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(password, 12);
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "HOST",
        },
      });

      // Link the session player to the new user
      await tx.sessionPlayer.update({
        where: { id: sessionPlayerId },
        data: { userId: createdUser.id },
      });

      return createdUser;
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        message: "Account created and session data saved!",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Claim session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
