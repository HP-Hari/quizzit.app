import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";

// Resend client will be initialized at runtime inside the POST handler

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = forgotPasswordSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email } = validated.data;

    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return a success message even if the user is not found to prevent user enumeration attacks
      return NextResponse.json({
        success: true,
        message: "If the email is registered, you will receive an OTP code shortly.",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Transaction to delete existing OTPs and create a new one atomically
    await prisma.$transaction(async (tx) => {
      // Delete any existing OTPs for this email to avoid duplicates/clutter
      await tx.passwordResetOtp.deleteMany({
        where: { email },
      });

      // Create the new OTP record
      await tx.passwordResetOtp.create({
        data: {
          email,
          otp,
          expiresAt,
        },
      });
    });

    console.log(`[OTP Generator] For email: ${email} -> OTP is: ${otp}`);
    // Initialize Resend client after verifying API key
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not defined. OTP is:", otp);
      return NextResponse.json({
        success: true,
        message: "OTP generated successfully (check server logs in development).",
      });
    }
    const { Resend } = await import("resend");
const resend = new Resend(process.env.RESEND_API_KEY);


    // Send email using Resend
    await resend.emails.send({
      from: "Quizzit <onboarding@resend.dev>",
      to: email,
      subject: "Your Quizzit Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #6C5CE7; text-align: center; margin-bottom: 24px;">Quizzit Verification Code</h2>
          <p style="font-size: 16px; color: #333333; line-height: 1.5;">Hello,</p>
          <p style="font-size: 16px; color: #333333; line-height: 1.5;">You requested to reset your password on Quizzit. Please use the following 6-digit verification code to complete your password change:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #00D2FF; background-color: #f7f9fc; padding: 12px 24px; border-radius: 6px; border: 1px dashed #6C5CE7; display: inline-block;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 14px; color: #777777; line-height: 1.5;">This code is valid for <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #999999; text-align: center;">Quizzit Interactive Quiz Platform</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "If the email is registered, you will receive an OTP code shortly.",
    });
  } catch (error) {
    console.error("Forgot password send-otp error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
