"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface SessionAnalytics {
  id: string;
  pin: string;
  status: string;
  mode: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  quiz: {
    title: string;
    slides: {
      id: string;
      orderIndex: number;
      slideType: string;
      questionText: string | null;
      options: { id: string; text: string; isCorrect: boolean }[];
    }[];
  };
  players: {
    id: string;
    nickname: string;
    totalScore: number;
    streak: number;
    finalRank: number | null;
  }[];
  responses: {
    id: string;
    playerId: string;
    slideId: string;
    isCorrect: boolean;
    pointsAwarded: number;
    responseTimeMs: number;
  }[];
}

export default function SessionAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <p>Session not found.</p>
      </div>
    );
  }

  const questionSlides = data.quiz.slides.filter((s) => s.slideType === "QUESTION");

  // Per-question accuracy
  const questionStats = questionSlides.map((slide) => {
    const slideResponses = data.responses.filter((r) => r.slideId === slide.id);
    const correct = slideResponses.filter((r) => r.isCorrect).length;
    const total = slideResponses.length;
    const avgTime = total > 0 ? Math.round(slideResponses.reduce((sum, r) => sum + r.responseTimeMs, 0) / total) : 0;

    return {
      slideId: slide.id,
      questionText: slide.questionText || `Question ${slide.orderIndex + 1}`,
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      avgTimeMs: avgTime,
    };
  });

  const overallAccuracy = questionStats.length > 0
    ? Math.round(questionStats.reduce((sum, q) => sum + q.accuracy, 0) / questionStats.length)
    : 0;

  const avgScore = data.players.length > 0
    ? Math.round(data.players.reduce((sum, p) => sum + p.totalScore, 0) / data.players.length)
    : 0;

  return (
    <div className="analytics-page">
      <nav className="navbar">
        <div className="flex items-center justify-between" style={{ width: "100%" }}>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
            <h2 className="font-display" style={{ fontSize: "var(--text-lg)" }}>{data.quiz.title} — Analytics</h2>
          </div>
          <a
            href={`/api/sessions/${id}/export`}
            className="btn btn-secondary btn-sm"
            download
          >
            📥 Export CSV
          </a>
        </div>
      </nav>

      <div className="analytics-content">
        {/* Summary Cards */}
        <div className="grid grid-4" style={{ gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Players</div>
            <div className="font-display" style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--primary-light)" }}>
              {data.players.length}
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Questions</div>
            <div className="font-display" style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--secondary)" }}>
              {questionSlides.length}
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Avg Accuracy</div>
            <div className="font-display" style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--success)" }}>
              {overallAccuracy}%
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Avg Score</div>
            <div className="font-display" style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "var(--warning)" }}>
              {avgScore}
            </div>
          </div>
        </div>

        {/* Per-Question Accuracy */}
        <div className="card" style={{ marginBottom: "var(--space-8)" }}>
          <h3 className="font-display" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-6)" }}>
            📊 Per-Question Accuracy
          </h3>
          <div className="flex flex-col gap-4">
            {questionStats.map((q, i) => (
              <div key={q.slideId} className="question-stat-row">
                <div className="flex items-center gap-3" style={{ flex: 1 }}>
                  <span className="badge badge-primary">{i + 1}</span>
                  <span style={{ fontSize: "var(--text-sm)", flex: 1 }}>{q.questionText}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="stat-bar-container">
                    <div className="stat-bar" style={{ width: `${q.accuracy}%` }}></div>
                  </div>
                  <span className="font-mono" style={{ minWidth: 50, textAlign: "right", fontWeight: 600 }}>
                    {q.accuracy}%
                  </span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", minWidth: 60 }}>
                    {(q.avgTimeMs / 1000).toFixed(1)}s avg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Player Rankings */}
        <div className="card">
          <h3 className="font-display" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-6)" }}>
            🏆 Player Rankings
          </h3>
          <div className="flex flex-col gap-3">
            {data.players
              .sort((a, b) => b.totalScore - a.totalScore)
              .map((player, index) => {
                const playerResponses = data.responses.filter((r) => r.playerId === player.id);
                const correct = playerResponses.filter((r) => r.isCorrect).length;

                return (
                  <div key={player.id} className="leaderboard-item">
                    <span className="leaderboard-rank">{index + 1}</span>
                    <div className="avatar avatar-sm">{player.nickname[0].toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{player.nickname}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                        {correct}/{questionSlides.length} correct • {player.streak} best streak
                      </div>
                    </div>
                    <span className="leaderboard-score">{player.totalScore}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .analytics-page { min-height: 100vh; }
        .analytics-content { max-width: 1000px; margin: 0 auto; padding: var(--space-8) var(--space-6); }
        .question-stat-row { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--border-default); }
        .question-stat-row:last-child { border-bottom: none; }
        .stat-bar-container { width: 120px; height: 8px; background: var(--bg-tertiary); border-radius: var(--radius-full); overflow: hidden; }
        .stat-bar { height: 100%; background: linear-gradient(90deg, var(--primary), var(--success)); border-radius: var(--radius-full); transition: width 0.5s ease; }
        @media (max-width: 768px) {
          .question-stat-row { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
