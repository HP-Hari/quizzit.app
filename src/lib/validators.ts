import { z } from "zod";

// ---- Auth Schemas ----
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ---- Quiz Schemas ----
export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
});

export const updateQuizSchema = createQuizSchema.partial();

export const createSlideSchema = z.object({
  quizId: z.string(),
  orderIndex: z.number().int().min(0),
  slideType: z.enum(["QUESTION", "CONTENT", "POLL", "WORD_CLOUD"]),
  title: z.string().optional(),
  bodyMarkdown: z.string().optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  questionText: z.string().optional(),
  questionType: z.enum(["MCQ", "TRUE_FALSE", "MULTI_SELECT", "OPEN_ENDED", "POLL"]).optional(),
  timeLimitSec: z.number().int().min(5).max(300).optional().default(30),
  pointsBase: z.number().int().min(0).max(10000).optional().default(1000),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        isCorrect: z.boolean().default(false),
        orderIndex: z.number().int(),
        mediaUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .optional()
    .default([]),
});

export const updateSlideSchema = createSlideSchema.partial().omit({ quizId: true });

// ---- Session Schemas ----
export const createSessionSchema = z.object({
  quizId: z.string(),
  teamMode: z.boolean().optional().default(false),
  teamCount: z.number().int().min(2).max(20).optional(),
});

export const joinSessionSchema = z.object({
  pin: z.string().length(6, "PIN must be 6 digits"),
  nickname: z.string().min(1, "Nickname is required").max(20),
});

// ---- WebSocket Event Schemas ----
export const answerSubmitSchema = z.object({
  slideIndex: z.number().int().min(0),
  selectedOptionIds: z.array(z.string()).optional(),
  openEndedText: z.string().max(500).optional(),
});

export const wordCloudSubmitSchema = z.object({
  slideIndex: z.number().int().min(0),
  words: z.array(z.string().max(30)).min(1).max(5),
});

// ---- AI Generation Schema ----
export const aiGenerateSchema = z.object({
  topic: z.string().min(1).max(500),
  questionCount: z.number().int().min(1).max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  questionType: z.enum(["MCQ", "TRUE_FALSE", "MULTI_SELECT", "mixed"]).default("mixed"),
});

// ---- Type Exports ----
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type CreateSlideInput = z.infer<typeof createSlideSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type JoinSessionInput = z.infer<typeof joinSessionSchema>;
export type AnswerSubmitInput = z.infer<typeof answerSubmitSchema>;
export type AIGenerateInput = z.infer<typeof aiGenerateSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

export const claimSessionSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  sessionPlayerId: z.string().min(1, "Session player ID is required"),
});

export type ClaimSessionInput = z.infer<typeof claimSessionSchema>;

