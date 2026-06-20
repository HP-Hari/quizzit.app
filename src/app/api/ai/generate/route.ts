import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { aiGenerateSchema } from "@/lib/validators";

// POST /api/ai/generate — Generate quiz questions using AI
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = aiGenerateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { topic, questionCount, difficulty, questionType } = validated.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI generation is not configured. Set GEMINI_API_KEY in your environment." },
        { status: 503 }
      );
    }

    const prompt = `Generate ${questionCount} quiz questions about "${topic}" at ${difficulty} difficulty level.

${questionType === "mixed" ? "Mix question types: multiple choice, true/false, and multi-select." : `All questions should be ${questionType} type.`}

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "questionText": "The question text",
    "questionType": "MCQ" | "TRUE_FALSE" | "MULTI_SELECT",
    "timeLimitSec": 30,
    "pointsBase": 1000,
    "options": [
      { "text": "Option A", "isCorrect": true },
      { "text": "Option B", "isCorrect": false },
      { "text": "Option C", "isCorrect": false },
      { "text": "Option D", "isCorrect": false }
    ]
  }
]

Rules:
- Each MCQ must have exactly 4 options with exactly 1 correct answer
- TRUE_FALSE must have exactly 2 options: "True" and "False"
- MULTI_SELECT can have 2+ correct answers
- Questions should be clear, factual, and educational
- Vary difficulty appropriately`;

    const models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
    let response = null;
    let model = "";
    let lastErrorText = "";

    for (const currentModel of models) {
      model = currentModel;
      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json",
                },
              }),
            }
          );

          if (response.ok) {
            break;
          } else {
            lastErrorText = await response.text();
            console.warn(`Gemini API failed for model ${model} (status ${response.status}, attempt ${attempt}/${maxAttempts}): ${lastErrorText}`);
            
            // Retry on temporary rate limits or overload status codes
            if (response.status === 429 || response.status === 503) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          }
        } catch (err) {
          lastErrorText = String(err);
          console.warn(`Fetch error for model ${model} (attempt ${attempt}/${maxAttempts}):`, err);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (response && response.ok) {
        break;
      }
    }

    if (!response || !response.ok) {
      console.error(`All Gemini models failed. Last error details:`, lastErrorText);
      return NextResponse.json(
        { error: `AI service unavailable: ${lastErrorText}` },
        { status: 502 }
      );
    }

    const aiResult = await response.json();
    const textContent = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Robust JSON parsing
    let questions = null;
    try {
      const parsed = JSON.parse(textContent.trim());
      if (Array.isArray(parsed)) {
        questions = parsed;
      } else if (parsed && typeof parsed === "object") {
        // Handle case where AI wraps the array in an object key like "questions" or "quiz"
        const keys = Object.keys(parsed);
        const arrayKey = keys.find((k) => Array.isArray(parsed[k]));
        if (arrayKey) {
          questions = parsed[arrayKey];
        }
      }
    } catch (parseErr) {
      console.warn("Direct JSON parsing failed. Trying regex extraction...", parseErr);
      const jsonMatch = textContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          questions = JSON.parse(jsonMatch[0]);
        } catch (regexParseErr) {
          console.error("Regex JSON parsing failed too:", regexParseErr);
        }
      }
    }

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: "AI returned invalid response format or empty list of questions" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      questions: questions.map((q: { questionText: string; questionType: string; timeLimitSec?: number; pointsBase?: number; options: { text: string; isCorrect: boolean }[] }, i: number) => ({
        slideType: "QUESTION",
        orderIndex: i,
        questionText: q.questionText,
        questionType: q.questionType || "MCQ",
        timeLimitSec: q.timeLimitSec || 30,
        pointsBase: q.pointsBase || 1000,
        options: q.options.map((o: { text: string; isCorrect: boolean }, j: number) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          orderIndex: j,
        })),
      })),
    });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
