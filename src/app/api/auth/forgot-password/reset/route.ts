import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = resetPasswordSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, otp, newPassword } = validated.data;

    // Check if the OTP exists and matches
    const otpRecord = await prisma.passwordResetOtp.findFirst({
      where: {
        email,
        otp,
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      // Delete the expired OTP
      await prisma.passwordResetOtp.delete({
        where: { id: otpRecord.id },
      });
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update the password in database
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // Delete the used OTP record
    await prisma.passwordResetOtp.delete({
      where: { id: otpRecord.id },
    });

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully reset.",
    });
  } catch (error) {
    console.error("Forgot password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
