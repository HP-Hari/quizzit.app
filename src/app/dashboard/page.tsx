"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  isPublic: boolean;
  tags: string[];
  slides: { id: string; slideType: string; questionType: string | null }[];
  _count: { sessions: number };
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch("/api/quizzes");
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      }
    } catch (err) {
      console.error("Failed to fetch quizzes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard — Quizzit";
    Promise.resolve().then(() => {
      fetchQuizzes();
    });
  }, [fetchQuizzes]);

  async function createQuiz() {
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc }),
      });

      if (res.ok) {
        const quiz = await res.json();
        router.push(`/dashboard/quiz/${quiz.id}`);
      }
    } catch (err) {
      console.error("Failed to create quiz:", err);
    } finally {
      setCreating(false);
    }
  }

  async function deleteQuiz(id: string) {
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      setQuizzes(quizzes.filter((q) => q.id !== id));
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    }
  }

  async function startSession(quizId: string) {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });

      if (res.ok) {
        const session = await res.json();
        router.push(`/host/${session.id}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create session");
      }
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  }

  return (
    <div className="dashboard-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="flex items-center justify-between" style={{ width: "100%", padding: "0 1rem" }}>
          <Link href="/dashboard" className="navbar-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#lg4)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="lg4" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6C5CE7" /><stop offset="1" stopColor="#00D2FF" /></linearGradient></defs>
            </svg>
            <span>Quizzit</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sessions" className="btn btn-ghost btn-sm">📊 Sessions</Link>
            <Link href="/play" className="btn btn-ghost btn-sm">🎮 Join Game</Link>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-ghost btn-sm" id="logout-btn">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="dash-content">
        <div className="dash-header">
          <div>
            <h1 className="font-display" style={{ fontSize: "var(--text-3xl)", fontWeight: 800 }}>My Quizzes</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>Create, manage, and host your interactive quizzes</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowNewModal(true)} id="new-quiz-btn">
            + New Quiz
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: "var(--space-16)" }}>
            <div className="spinner"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="empty-state animate-fade-in-up">
            <div className="empty-icon">🎯</div>
            <h2 className="font-display">No quizzes yet</h2>
            <p>Create your first interactive quiz and start engaging your audience!</p>
            <button className="btn btn-primary btn-lg" onClick={() => setShowNewModal(true)}>
              + Create Your First Quiz
            </button>
          </div>
        ) : (
          <div className="quiz-grid stagger-children">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="quiz-card card">
                <div className="quiz-card-header">
                  <h3 className="font-display">{quiz.title}</h3>
                  <div className="flex gap-2">
                    {quiz.isDraft && <span className="badge badge-warning">Draft</span>}
                    {quiz.isPublic && <span className="badge badge-info">Public</span>}
                  </div>
                </div>
                {quiz.description && (
                  <p className="quiz-card-desc">{quiz.description}</p>
                )}
                <div className="quiz-card-stats">
                  <span>📝 {quiz.slides.length} slides</span>
                  <span>🎮 {quiz._count.sessions} sessions</span>
                </div>
                <div className="quiz-card-actions">
                  <Link href={`/dashboard/quiz/${quiz.id}`} className="btn btn-secondary btn-sm">
                    ✏️ Edit
                  </Link>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => startSession(quiz.id)}
                    disabled={quiz.slides.length === 0}
                  >
                    ▶️ Host Live
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteQuiz(quiz.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Quiz Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Quiz</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="input-group">
                <label htmlFor="quiz-title" className="input-label">Quiz Title</label>
                <input
                  id="quiz-title"
                  type="text"
                  className="input"
                  placeholder="e.g., World History Chapter 5"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label htmlFor="quiz-desc" className="input-label">Description (optional)</label>
                <textarea
                  id="quiz-desc"
                  className="input textarea"
                  placeholder="Brief description of your quiz..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={createQuiz}
                disabled={!newTitle.trim() || creating}
                id="create-quiz-submit-btn"
              >
                {creating ? <span className="spinner spinner-sm"></span> : "Create & Start Editing"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard-page { min-height: 100vh; }
        .dash-content { max-width: 1200px; margin: 0 auto; padding: var(--space-8) var(--space-6); }
        .dash-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-8); }
        .empty-state {
          text-align: center; padding: var(--space-16) var(--space-8);
          background: var(--bg-secondary); border: 1px dashed var(--border-light);
          border-radius: var(--radius-2xl);
        }
        .empty-icon { font-size: 4rem; margin-bottom: var(--space-4); }
        .empty-state h2 { font-size: var(--text-2xl); margin-bottom: var(--space-3); }
        .empty-state p { color: var(--text-secondary); margin-bottom: var(--space-6); }
        .quiz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: var(--space-6); }
        .quiz-card { display: flex; flex-direction: column; gap: var(--space-3); }
        .quiz-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
        .quiz-card-header h3 { font-size: var(--text-lg); font-weight: 700; }
        .quiz-card-desc { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .quiz-card-stats { display: flex; gap: var(--space-4); color: var(--text-tertiary); font-size: var(--text-sm); }
        .quiz-card-actions { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
        @media (max-width: 768px) {
          .dash-header { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
          .quiz-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
