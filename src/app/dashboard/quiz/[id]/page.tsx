"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface QuestionOption {
  id?: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface Slide {
  id?: string;
  orderIndex: number;
  slideType: string;
  title: string;
  bodyMarkdown: string;
  questionText: string;
  questionType: string;
  timeLimitSec: number;
  pointsBase: number;
  codeSnippet: string;
  codeLanguage: string;
  mediaUrl: string;
  options: QuestionOption[];
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  isDraft: boolean;
  isPublic: boolean;
  slides: Slide[];
}

const DEFAULT_SLIDE: Omit<Slide, "orderIndex"> = {
  slideType: "QUESTION",
  title: "",
  bodyMarkdown: "",
  questionText: "",
  questionType: "MCQ",
  timeLimitSec: 30,
  pointsBase: 1000,
  codeSnippet: "",
  codeLanguage: "",
  mediaUrl: "",
  options: [
    { text: "", isCorrect: true, orderIndex: 0 },
    { text: "", isCorrect: false, orderIndex: 1 },
    { text: "", isCorrect: false, orderIndex: 2 },
    { text: "", isCorrect: false, orderIndex: 3 },
  ],
};

export default function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiReplace, setAiReplace] = useState(false);
  const router = useRouter();

  const fetchQuiz = useCallback(async () => {
    const res = await fetch(`/api/quizzes/${id}`);
    if (res.ok) {
      const data = await res.json();
      setQuiz(data);
      setSlides(data.slides || []);
      setIsDirty(false);
    }
  }, [id]);

  useEffect(() => {
    document.title = "Quiz Editor — Quizzit";
    Promise.resolve().then(() => {
      fetchQuiz();
    });
  }, [id, fetchQuiz]);

  async function generateWithAI() {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic, questionCount: aiCount, difficulty: aiDifficulty, questionType: "mixed" }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "AI generation failed");
        return;
      }
      const data = await res.json();
      const baseIndex = aiReplace ? 0 : slides.length;
      const newSlides: Slide[] = data.questions.map((q: { slideType: string; orderIndex: number; questionText: string; questionType: string; timeLimitSec: number; pointsBase: number; options: { text: string; isCorrect: boolean; orderIndex: number }[] }, i: number) => ({
        ...DEFAULT_SLIDE,
        slideType: q.slideType || "QUESTION",
        orderIndex: baseIndex + i,
        questionText: q.questionText || "",
        questionType: q.questionType || "MCQ",
        timeLimitSec: q.timeLimitSec || 30,
        pointsBase: q.pointsBase || 1000,
        options: q.options.map((o: { text: string; isCorrect: boolean; orderIndex: number }) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          orderIndex: o.orderIndex,
        })),
      }));

      if (aiReplace) {
        setSlides(newSlides);
        setActiveIndex(0);
      } else {
        setSlides([...slides, ...newSlides]);
        setActiveIndex(slides.length);
      }
      setShowAiModal(false);
      setAiTopic("");
      setSaved(false);
      setIsDirty(true);
    } catch (err) {
      console.error("AI generate error:", err);
      alert("Failed to generate. Please try again.");
    } finally {
      setAiGenerating(false);
    }
  }

  function addSlide(slideType: string = "QUESTION") {
    const newSlide: Slide = {
      ...DEFAULT_SLIDE,
      slideType,
      questionType: slideType === "QUESTION" ? "MCQ" : slideType === "POLL" ? "POLL" : "",
      orderIndex: slides.length,
      options: slideType === "CONTENT" || slideType === "WORD_CLOUD" ? [] : DEFAULT_SLIDE.options.map((o) => ({ ...o })),
    };
    setSlides([...slides, newSlide]);
    setActiveIndex(slides.length);
    setIsDirty(true);
  }

  function updateSlide(index: number, updates: Partial<Slide>) {
    const updated = [...slides];
    updated[index] = { ...updated[index], ...updates };
    setSlides(updated);
    setSaved(false);
    setIsDirty(true);
  }

  function updateOption(slideIndex: number, optIndex: number, updates: Partial<QuestionOption>) {
    const updated = [...slides];
    const slide = { ...updated[slideIndex] };
    const options = [...slide.options];
    options[optIndex] = { ...options[optIndex], ...updates };

    // For MCQ/TRUE_FALSE, only one correct answer
    if (updates.isCorrect && (slide.questionType === "MCQ" || slide.questionType === "TRUE_FALSE")) {
      options.forEach((opt, i) => {
        if (i !== optIndex) opt.isCorrect = false;
      });
    }

    slide.options = options;
    updated[slideIndex] = slide;
    setSlides(updated);
    setSaved(false);
    setIsDirty(true);
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== index);
    updated.forEach((s, i) => (s.orderIndex = i));
    setSlides(updated);
    setActiveIndex(Math.min(activeIndex, updated.length - 1));
    setIsDirty(true);
  }

  function addOption(slideIndex: number) {
    const updated = [...slides];
    const slide = { ...updated[slideIndex] };
    slide.options = [...slide.options, { text: "", isCorrect: false, orderIndex: slide.options.length }];
    updated[slideIndex] = slide;
    setSlides(updated);
    setIsDirty(true);
  }

  const saveAll = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/slides/bulk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: slides.map((slide) => ({
            orderIndex: slide.orderIndex,
            slideType: slide.slideType,
            title: slide.title || undefined,
            bodyMarkdown: slide.bodyMarkdown || undefined,
            questionText: slide.questionText || undefined,
            questionType: slide.questionType || undefined,
            timeLimitSec: slide.timeLimitSec,
            pointsBase: slide.pointsBase,
            codeSnippet: slide.codeSnippet || undefined,
            codeLanguage: slide.codeLanguage || undefined,
            options: slide.options.map((o, i) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              orderIndex: i,
            })),
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("Bulk save failed");
      }

      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchQuiz();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [id, slides, fetchQuiz]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirty || slides.length === 0) return;

    const timer = setTimeout(() => {
      saveAll();
    }, 2500);

    return () => clearTimeout(timer);
  }, [slides, isDirty, saveAll]);

  const currentSlide = slides[activeIndex];

  if (!quiz) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      {/* Top Bar */}
      <div className="editor-topbar">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn btn-ghost btn-sm">← Back</Link>
          <h2 className="font-display" style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{quiz.title}</h2>
          {saving ? (
            <span className="badge badge-info" style={{ animation: "pulse 1.5s infinite" }}>⏳ Autosaving...</span>
          ) : saved ? (
            <span className="badge badge-success">✓ Saved</span>
          ) : isDirty ? (
            <span className="badge badge-warning">⚠️ Unsaved changes</span>
          ) : (
            <span className="badge badge-success" style={{ opacity: 0.8 }}>✓ Saved</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            {slides.length} slide{slides.length !== 1 ? "s" : ""}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={saveAll} disabled={saving} id="save-quiz-btn">
            {saving ? <span className="spinner spinner-sm"></span> : "💾 Save All"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              saveAll().then(() => {
                fetch("/api/sessions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ quizId: id }),
                }).then(r => r.json()).then(s => router.push(`/host/${s.id}`));
              });
            }}
            disabled={slides.length === 0}
            id="host-quiz-btn"
          >
            ▶️ Host Live
          </button>
        </div>
      </div>

      <div className="editor-body">
        {/* Slide List (Sidebar) */}
        <div className="slide-list">
          <div className="slide-list-header">
            <span className="input-label">SLIDES</span>
          </div>
          <div className="slide-list-items">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`slide-thumb ${activeIndex === index ? "active" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className="slide-number">{index + 1}</span>
                <div className="slide-thumb-info">
                  <span className="slide-type-badge">{slide.slideType === "QUESTION" ? "Q" : slide.slideType === "CONTENT" ? "C" : slide.slideType === "POLL" ? "P" : "W"}</span>
                  <span className="slide-thumb-text">
                    {slide.questionText || slide.title || `Slide ${index + 1}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="slide-add-buttons">
            <button className="btn btn-primary btn-sm" style={{ width: "100%" }} onClick={() => addSlide("QUESTION")}>
              + Question
            </button>
            <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={() => addSlide("CONTENT")}>
              + Content Slide
            </button>
            <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={() => addSlide("POLL")}>
              + Poll
            </button>
            <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={() => addSlide("WORD_CLOUD")}>
              + Word Cloud
            </button>
            <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "var(--space-2)", marginTop: "var(--space-1)" }}>
              <button className="btn btn-sm" style={{ width: "100%", background: "linear-gradient(135deg, #6C5CE7, #00D2FF)", color: "white", fontWeight: 700 }} onClick={() => setShowAiModal(true)} id="ai-generate-btn">
                ✨ AI Generate
              </button>
            </div>
          </div>
        </div>

        {/* Slide Editor (Main Area) */}
        <div className="slide-editor">
          {!currentSlide ? (
            <div className="empty-state" style={{ marginTop: "var(--space-16)" }}>
              <div className="empty-icon">✏️</div>
              <h2 className="font-display">Add your first slide</h2>
              <p>Click &quot;+ Question&quot; to get started</p>
            </div>
          ) : currentSlide.slideType === "QUESTION" || currentSlide.slideType === "POLL" ? (
            <div className="slide-form">
              <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
                <h3 className="font-display" style={{ fontSize: "var(--text-xl)" }}>
                  {currentSlide.slideType === "POLL" ? "📊 Poll" : "❓ Question"} {activeIndex + 1}
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => removeSlide(activeIndex)} style={{ color: "var(--error)" }}>
                  🗑️ Remove
                </button>
              </div>

              {currentSlide.slideType === "QUESTION" && (
                <div className="input-group">
                  <label className="input-label">Question Type</label>
                  <select
                    className="input select"
                    value={currentSlide.questionType}
                    onChange={(e) => {
                      const qType = e.target.value;
                      const opts =
                        qType === "TRUE_FALSE"
                          ? [
                              { text: "True", isCorrect: true, orderIndex: 0 },
                              { text: "False", isCorrect: false, orderIndex: 1 },
                            ]
                          : qType === "OPEN_ENDED"
                            ? []
                            : currentSlide.options;
                      updateSlide(activeIndex, { questionType: qType, options: opts });
                    }}
                  >
                    <option value="MCQ">Multiple Choice</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="MULTI_SELECT">Multi-Select</option>
                    <option value="OPEN_ENDED">Open-Ended</option>
                  </select>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Question Text</label>
                <textarea
                  className="input textarea"
                  placeholder="Type your question here..."
                  value={currentSlide.questionText || ""}
                  onChange={(e) => updateSlide(activeIndex, { questionText: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Code Snippet (optional)</label>
                <textarea
                  className="input textarea"
                  placeholder="Paste code here..."
                  value={currentSlide.codeSnippet || ""}
                  onChange={(e) => updateSlide(activeIndex, { codeSnippet: e.target.value })}
                  rows={3}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                />
              </div>

              <div className="flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Time Limit (sec)</label>
                  <input
                    type="number"
                    className="input"
                    value={currentSlide.timeLimitSec}
                    onChange={(e) => updateSlide(activeIndex, { timeLimitSec: parseInt(e.target.value) || 30 })}
                    min={5}
                    max={300}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Points</label>
                  <input
                    type="number"
                    className="input"
                    value={currentSlide.pointsBase}
                    onChange={(e) => updateSlide(activeIndex, { pointsBase: parseInt(e.target.value) || 1000 })}
                    min={0}
                    max={10000}
                    step={100}
                  />
                </div>
              </div>

              {/* Answer Options */}
              {currentSlide.questionType !== "OPEN_ENDED" && (
                <div className="options-editor">
                  <label className="input-label">Answer Options</label>
                  <div className="options-list">
                    {currentSlide.options.map((opt, optIdx) => {
                      const colors = ["var(--answer-a)", "var(--answer-b)", "var(--answer-c)", "var(--answer-d)"];
                      return (
                        <div key={optIdx} className="option-row">
                          <div
                            className="option-color-bar"
                            style={{ background: colors[optIdx % 4] }}
                          ></div>
                          <input
                            type="text"
                            className="input"
                            placeholder={`Option ${optIdx + 1}`}
                            value={opt.text}
                            onChange={(e) => updateOption(activeIndex, optIdx, { text: e.target.value })}
                          />
                          <label className="correct-toggle">
                            <input
                              type={currentSlide.questionType === "MULTI_SELECT" ? "checkbox" : "radio"}
                              name={`correct-${activeIndex}`}
                              checked={opt.isCorrect}
                              onChange={() => updateOption(activeIndex, optIdx, { isCorrect: !opt.isCorrect })}
                            />
                            <span className="correct-label">✓</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {currentSlide.questionType !== "TRUE_FALSE" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => addOption(activeIndex)} style={{ marginTop: "var(--space-2)" }}>
                      + Add Option
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : currentSlide.slideType === "CONTENT" ? (
            <div className="slide-form">
              <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
                <h3 className="font-display" style={{ fontSize: "var(--text-xl)" }}>📄 Content Slide {activeIndex + 1}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => removeSlide(activeIndex)} style={{ color: "var(--error)" }}>🗑️ Remove</button>
              </div>
              <div className="input-group">
                <label className="input-label">Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Slide title..."
                  value={currentSlide.title || ""}
                  onChange={(e) => updateSlide(activeIndex, { title: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Content (Markdown supported)</label>
                <textarea
                  className="input textarea"
                  placeholder="Write your content in Markdown..."
                  value={currentSlide.bodyMarkdown || ""}
                  onChange={(e) => updateSlide(activeIndex, { bodyMarkdown: e.target.value })}
                  rows={10}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Code Snippet (optional)</label>
                <textarea
                  className="input textarea"
                  placeholder="Paste code here..."
                  value={currentSlide.codeSnippet || ""}
                  onChange={(e) => updateSlide(activeIndex, { codeSnippet: e.target.value })}
                  rows={4}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                />
              </div>
            </div>
          ) : (
            <div className="slide-form">
              <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
                <h3 className="font-display" style={{ fontSize: "var(--text-xl)" }}>☁️ Word Cloud {activeIndex + 1}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => removeSlide(activeIndex)} style={{ color: "var(--error)" }}>🗑️ Remove</button>
              </div>
              <div className="input-group">
                <label className="input-label">Prompt</label>
                <textarea
                  className="input textarea"
                  placeholder="What word comes to mind when you think of..."
                  value={currentSlide.questionText || ""}
                  onChange={(e) => updateSlide(activeIndex, { questionText: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Time Limit (sec)</label>
                <input
                  type="number"
                  className="input"
                  value={currentSlide.timeLimitSec}
                  onChange={(e) => updateSlide(activeIndex, { timeLimitSec: parseInt(e.target.value) || 30 })}
                  min={10}
                  max={120}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Generate Modal */}
      {showAiModal && (
        <div className="modal-overlay" onClick={() => setShowAiModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">✨ AI Generate Questions</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAiModal(false)}>✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="input-group">
                <label className="input-label">Topic</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., World War II, JavaScript basics, Solar System"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Number of Questions</label>
                  <input
                    type="number"
                    className="input"
                    value={aiCount}
                    onChange={(e) => setAiCount(parseInt(e.target.value) || 5)}
                    min={1}
                    max={20}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Difficulty</label>
                  <select className="input select" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2" style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <input
                  type="checkbox"
                  id="ai-replace-checkbox"
                  checked={aiReplace}
                  onChange={(e) => setAiReplace(e.target.checked)}
                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                />
                <label htmlFor="ai-replace-checkbox" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                  Replace all existing slides
                </label>
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={generateWithAI}
                disabled={!aiTopic.trim() || aiGenerating}
                id="ai-generate-submit-btn"
              >
                {aiGenerating ? <><span className="spinner spinner-sm"></span> Generating...</> : "Generate Questions"}
              </button>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textAlign: "center" }}>
                Requires GEMINI_API_KEY to be configured
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .editor-page { min-height: 100vh; display: flex; flex-direction: column; }
        .editor-topbar {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-3) var(--space-6);
          background: rgba(10, 10, 26, 0.9); backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-default);
        }
        .editor-body { display: flex; flex: 1; }
        .slide-list {
          width: 260px; min-width: 260px;
          background: var(--bg-secondary); border-right: 1px solid var(--border-default);
          display: flex; flex-direction: column; height: calc(100vh - 56px); position: sticky; top: 56px;
        }
        .slide-list-header { padding: var(--space-4); border-bottom: 1px solid var(--border-default); }
        .slide-list-items { flex: 1; overflow-y: auto; padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
        .slide-thumb {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3); border-radius: var(--radius-lg);
          cursor: pointer; transition: all var(--transition-fast);
          border: 1px solid transparent;
        }
        .slide-thumb:hover { background: var(--bg-card); }
        .slide-thumb.active { background: rgba(108, 92, 231, 0.15); border-color: var(--primary); }
        .slide-number { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); min-width: 20px; }
        .slide-thumb-info { display: flex; align-items: center; gap: var(--space-2); overflow: hidden; }
        .slide-type-badge {
          width: 22px; height: 22px; border-radius: var(--radius-sm);
          background: var(--bg-elevated); display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; flex-shrink: 0;
        }
        .slide-thumb-text { font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary); }
        .slide-add-buttons { padding: var(--space-3); border-top: 1px solid var(--border-default); display: flex; flex-direction: column; gap: var(--space-2); }
        .slide-editor { flex: 1; padding: var(--space-8); overflow-y: auto; }
        .slide-form { max-width: 700px; display: flex; flex-direction: column; gap: var(--space-5); }
        .options-editor { display: flex; flex-direction: column; gap: var(--space-3); }
        .options-list { display: flex; flex-direction: column; gap: var(--space-3); }
        .option-row { display: flex; align-items: center; gap: var(--space-3); }
        .option-color-bar { width: 6px; height: 40px; border-radius: var(--radius-full); flex-shrink: 0; }
        .correct-toggle { position: relative; cursor: pointer; }
        .correct-toggle input { position: absolute; opacity: 0; }
        .correct-label {
          width: 36px; height: 36px; border-radius: var(--radius-lg);
          background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;
          font-weight: 700; transition: all var(--transition-fast);
          color: var(--text-tertiary);
        }
        .correct-toggle input:checked + .correct-label { background: var(--success); color: white; }
        .empty-state { text-align: center; }
        .empty-icon { font-size: 3rem; margin-bottom: var(--space-4); }
        .empty-state h2 { font-size: var(--text-xl); margin-bottom: var(--space-2); }
        .empty-state p { color: var(--text-secondary); }
        @media (max-width: 768px) {
          .slide-list { display: none; }
          .editor-body { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
