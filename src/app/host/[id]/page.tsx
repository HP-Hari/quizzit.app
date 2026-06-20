"use client";

import { useState, useEffect, use } from "react";
import { useSocket } from "@/lib/hooks/useSocket";

interface Player {
  id: string;
  nickname: string;
  avatarSeed: string;
}

interface SlideData {
  slideIndex: number;
  slideType: string;
  questionText: string | null;
  questionType: string | null;
  title: string | null;
  bodyMarkdown: string | null;
  timeLimit: number;
  totalSlides: number;
  codeSnippet: string | null;
  options: { id: string; text: string; orderIndex: number }[];
}

interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

type HostPhase = "loading" | "lobby" | "question" | "results" | "leaderboard" | "podium";

export default function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const { socket, isConnected, emit, on, off } = useSocket();

  const [phase, setPhase] = useState<HostPhase>("loading");
  const [sessionData, setSessionData] = useState<{ pin: string; quizTitle: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentSlide, setCurrentSlide] = useState<SlideData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCount, setAnswerCount] = useState({ count: 0, total: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);
  const [podium, setPodium] = useState<{ rank: number; nickname: string; score: number }[]>([]);
  const [wordCloudData, setWordCloudData] = useState<{ text: string; weight: number }[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, number>>({});

  // Fetch session data and create lobby
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSessionData({ pin: data.pin, quizTitle: data.quiz.title });
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      }
    }
    init();
  }, [sessionId]);

  // Create lobby when socket connects and we have session data
  useEffect(() => {
    if (socket && isConnected && sessionData) {
      emit("lobby:create", { sessionId, pin: sessionData.pin });
    }
  }, [socket, isConnected, sessionData, sessionId, emit]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handlers: [string, (...args: unknown[]) => void][] = [
      ["lobby:created", (() => {
        setPhase("lobby");
      }) as (...args: unknown[]) => void],
      ["lobby:player_joined", ((data: { player: Player; totalPlayers: number }) => {
        setPlayers((prev) => [...prev.filter((p) => p.id !== data.player.id), data.player]);
      }) as (...args: unknown[]) => void],
      ["lobby:player_left", ((data: { playerId: string }) => {
        setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      }) as (...args: unknown[]) => void],
      ["game:started", (() => {
        setPhase("question");
      }) as (...args: unknown[]) => void],
      ["game:slide", ((data: SlideData) => {
        setCurrentSlide(data);
        setTimeRemaining(data.timeLimit);
        setPhase("question");
        setAnswerCount({ count: 0, total: players.length });
        setCorrectOptionIds([]);
        setWordCloudData([]);
        setPollResults({});
      }) as (...args: unknown[]) => void],
      ["game:countdown", ((data: { secondsRemaining: number }) => {
        setTimeRemaining(data.secondsRemaining);
      }) as (...args: unknown[]) => void],
      ["game:answer_count", ((data: { count: number; total: number }) => {
        setAnswerCount(data);
      }) as (...args: unknown[]) => void],
      ["game:results", ((data: { correctOptionIds: string[] }) => {
        setCorrectOptionIds(data.correctOptionIds || []);
        setPhase("results");
      }) as (...args: unknown[]) => void],
      ["game:leaderboard", ((data: { top10: LeaderboardEntry[]; fullRankings?: LeaderboardEntry[] }) => {
        setLeaderboard(data.fullRankings || data.top10);
        setPhase("leaderboard");
      }) as (...args: unknown[]) => void],
      ["game:podium", ((data: { podium: { rank: number; nickname: string; score: number }[] }) => {
        setPodium(data.podium);
        setPhase("podium");
      }) as (...args: unknown[]) => void],
      ["wordcloud:update", ((data: { words: { text: string; weight: number }[] }) => {
        setWordCloudData(data.words);
      }) as (...args: unknown[]) => void],
      ["poll:results", ((data: { distribution: Record<string, number> }) => {
        setPollResults(data.distribution);
      }) as (...args: unknown[]) => void],
    ];

    handlers.forEach(([event, handler]) => on(event, handler));
    return () => {
      handlers.forEach(([event, handler]) => off(event, handler));
    };
  }, [socket, on, off, players.length]);

  const answerColors = ["var(--answer-a)", "var(--answer-b)", "var(--answer-c)", "var(--answer-d)"];

  return (
    <div className="host-page">
      {/* LOADING */}
      {phase === "loading" && (
        <div className="host-center">
          <div className="spinner spinner-lg"></div>
          <p style={{ marginTop: "var(--space-4)", color: "var(--text-secondary)" }}>Setting up game...</p>
        </div>
      )}

      {/* LOBBY */}
      {phase === "lobby" && sessionData && (
        <div className="host-center">
          <div className="lobby-display animate-fade-in">
            <h2 className="font-display" style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-2)" }}>
              {sessionData.quizTitle}
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)" }}>
              Join at <strong style={{ color: "var(--primary-light)" }}>{typeof window !== "undefined" ? window.location.origin : ""}/play</strong> or enter the PIN below
            </p>

            <div className="pin-card card-glass animate-glow" style={{ padding: "var(--space-8) var(--space-12)", marginBottom: "var(--space-8)" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Game PIN</span>
              <div className="pin-display">{sessionData.pin}</div>
            </div>

            <div style={{ marginBottom: "var(--space-6)" }}>
              <span className="badge badge-info" style={{ fontSize: "var(--text-base)", padding: "var(--space-2) var(--space-5)" }}>
                {players.length} player{players.length !== 1 ? "s" : ""} joined
              </span>
            </div>

            {/* Player Avatars */}
            <div className="lobby-players stagger-children">
              {players.map((p) => (
                <div key={p.id} className="lobby-player-tag">
                  <div className="avatar avatar-sm">{p.nickname[0].toUpperCase()}</div>
                  <span>{p.nickname}</span>
                  <button
                    className="kick-btn"
                    onClick={() => emit("lobby:kick", { playerId: p.id })}
                    title="Kick player"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary btn-xl"
              onClick={() => emit("game:start")}
              disabled={players.length === 0}
              style={{ marginTop: "var(--space-8)" }}
              id="start-game-btn"
            >
              🚀 Start Game ({players.length} player{players.length !== 1 ? "s" : ""})
            </button>
          </div>
        </div>
      )}

      {/* QUESTION */}
      {phase === "question" && currentSlide && (
        <div className="host-fullscreen">
          <div className="host-timer-bar">
            <div
              className="timer-fill"
              style={{
                width: `${(timeRemaining / (currentSlide.timeLimit || 30)) * 100}%`,
                background: timeRemaining <= 5 ? "var(--error)" : timeRemaining <= 10 ? "var(--warning)" : "var(--primary)",
              }}
            ></div>
          </div>

          <div className="host-question-header">
            <span className="badge badge-primary" style={{ fontSize: "var(--text-base)" }}>
              {currentSlide.slideIndex + 1} / {currentSlide.totalSlides}
            </span>
            <span className="badge badge-info">{answerCount.count} / {answerCount.total} answered</span>
            <div className="host-timer-number" style={{ color: timeRemaining <= 5 ? "var(--error)" : "var(--text-primary)" }}>
              {timeRemaining}
            </div>
          </div>

          <div className="host-question-body">
            <h1 className="font-display" style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)", textAlign: "center", lineHeight: 1.3 }}>
              {currentSlide.questionText || currentSlide.title}
            </h1>

            {currentSlide.codeSnippet && (
              <pre style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", fontFamily: "var(--font-mono)", fontSize: "var(--text-base)", maxWidth: "800px", width: "100%", overflow: "auto" }}>
                <code>{currentSlide.codeSnippet}</code>
              </pre>
            )}

            {/* Word Cloud Display */}
            {currentSlide.slideType === "WORD_CLOUD" && wordCloudData.length > 0 && (
              <div className="wordcloud-display">
                {wordCloudData.map((w, i) => (
                  <span
                    key={i}
                    className="wordcloud-word"
                    style={{ fontSize: `${Math.min(3, 0.8 + w.weight * 0.4)}rem`, opacity: 0.6 + w.weight * 0.1 }}
                  >
                    {w.text}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Options Display */}
          {currentSlide.options.length > 0 && (
            <div className="host-options-display">
              {currentSlide.options.map((opt, idx) => (
                <div
                  key={opt.id}
                  className="host-option"
                  style={{ background: answerColors[idx % 4] }}
                >
                  <span className="host-option-text">{opt.text}</span>
                  {Object.keys(pollResults).length > 0 && (
                    <span className="host-option-count">{pollResults[opt.id] || 0}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="host-controls">
            <button className="btn btn-secondary" onClick={() => emit("game:pause")}>⏸ Pause</button>
            <button className="btn btn-primary" onClick={() => emit("game:next")}>Next →</button>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {phase === "results" && currentSlide && (
        <div className="host-fullscreen">
          <h2 className="font-display" style={{ fontSize: "var(--text-3xl)", textAlign: "center", marginBottom: "var(--space-8)" }}>
            Results
          </h2>
          <div className="host-options-display" style={{ maxWidth: 700, margin: "0 auto" }}>
            {currentSlide.options.map((opt, idx) => (
              <div
                key={opt.id}
                className={`host-option ${correctOptionIds.includes(opt.id) ? "host-option-correct" : "host-option-wrong"}`}
                style={{ background: answerColors[idx % 4], opacity: correctOptionIds.includes(opt.id) ? 1 : 0.4 }}
              >
                <span className="host-option-text">{opt.text}</span>
                {correctOptionIds.includes(opt.id) && <span>✓</span>}
              </div>
            ))}
          </div>
          <div className="host-controls" style={{ marginTop: "var(--space-8)" }}>
            <button className="btn btn-primary btn-lg" onClick={() => emit("game:next")}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* LEADERBOARD */}
      {phase === "leaderboard" && (
        <div className="host-fullscreen">
          <h2 className="font-display text-gradient" style={{ fontSize: "var(--text-3xl)", textAlign: "center", marginBottom: "var(--space-8)" }}>
            🏆 Leaderboard
          </h2>
          <div className="host-leaderboard stagger-children">
            {leaderboard.slice(0, 10).map((entry) => (
              <div key={entry.playerId} className="leaderboard-item">
                <span className="leaderboard-rank">{entry.rank}</span>
                <div className="avatar avatar-sm">{entry.nickname[0].toUpperCase()}</div>
                <span style={{ flex: 1, fontWeight: 600, fontSize: "var(--text-lg)" }}>{entry.nickname}</span>
                <span className="leaderboard-score">{entry.score}</span>
              </div>
            ))}
          </div>
          <div className="host-controls" style={{ marginTop: "var(--space-8)" }}>
            <button className="btn btn-primary btn-lg" onClick={() => emit("game:next")}>
              Next Question →
            </button>
          </div>
        </div>
      )}

      {/* PODIUM */}
      {phase === "podium" && (
        <div className="host-center">
          <h1 className="font-display text-gradient" style={{ fontSize: "clamp(2rem, 5vw, 4rem)", marginBottom: "var(--space-8)" }}>
            🎉 Final Results!
          </h1>

          <div className="podium-container">
            {podium.length >= 2 && (
              <div className="podium-place">
                <div className="avatar avatar-lg">{podium[1].nickname[0].toUpperCase()}</div>
                <div style={{ fontWeight: 700 }}>{podium[1].nickname}</div>
                <div className="font-mono" style={{ color: "var(--text-secondary)" }}>{podium[1].score} pts</div>
                <div className="podium-bar podium-2nd">🥈</div>
              </div>
            )}
            {podium.length >= 1 && (
              <div className="podium-place">
                <div className="avatar avatar-xl" style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)" }}>{podium[0].nickname[0].toUpperCase()}</div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-xl)" }}>{podium[0].nickname}</div>
                <div className="font-mono" style={{ color: "var(--text-secondary)" }}>{podium[0].score} pts</div>
                <div className="podium-bar podium-1st">🥇</div>
              </div>
            )}
            {podium.length >= 3 && (
              <div className="podium-place">
                <div className="avatar avatar-lg">{podium[2].nickname[0].toUpperCase()}</div>
                <div style={{ fontWeight: 700 }}>{podium[2].nickname}</div>
                <div className="font-mono" style={{ color: "var(--text-secondary)" }}>{podium[2].score} pts</div>
                <div className="podium-bar podium-3rd">🥉</div>
              </div>
            )}
          </div>

          <button className="btn btn-secondary btn-lg" onClick={() => window.location.href = "/dashboard"} style={{ marginTop: "var(--space-8)" }}>
            ← Back to Dashboard
          </button>
        </div>
      )}

      <style jsx>{`
        .host-page { min-height: 100vh; background: var(--bg-primary); }
        .host-center { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-6); }
        .host-fullscreen { min-height: 100vh; display: flex; flex-direction: column; padding: var(--space-4); }
        .host-timer-bar { width: 100%; height: 8px; background: var(--bg-tertiary); border-radius: var(--radius-full); overflow: hidden; }
        .timer-fill { height: 100%; transition: width 1s linear; }
        .host-question-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-2); }
        .host-timer-number { font-family: var(--font-display); font-size: var(--text-4xl); font-weight: 800; }
        .host-question-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-6); padding: var(--space-4); }
        .host-options-display { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); padding: var(--space-4); }
        .host-option { padding: var(--space-5) var(--space-6); border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: space-between; min-height: 70px; }
        .host-option-text { font-size: var(--text-xl); font-weight: 700; color: white; }
        .host-option-count { font-family: var(--font-mono); font-size: var(--text-2xl); font-weight: 800; color: rgba(255,255,255,0.9); }
        .host-option-correct { outline: 3px solid var(--success); box-shadow: 0 0 20px rgba(81,207,102,0.4); }
        .host-controls { display: flex; gap: var(--space-3); justify-content: center; padding: var(--space-4); }
        .host-leaderboard { width: 100%; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-3); }
        .lobby-display { text-align: center; width: 100%; max-width: 700px; }
        .lobby-players { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: center; }
        .lobby-player-tag { display: flex; align-items: center; gap: var(--space-2); background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-full); padding: var(--space-2) var(--space-4); font-weight: 500; }
        .kick-btn { width: 20px; height: 20px; border-radius: 50%; background: transparent; color: var(--text-tertiary); font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition-fast); border: none; }
        .kick-btn:hover { background: var(--error); color: white; }
        .wordcloud-display { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: center; align-items: center; padding: var(--space-6); }
        .wordcloud-word { color: var(--primary-light); font-weight: 700; padding: var(--space-1) var(--space-2); animation: fadeIn 0.3s ease; }
        @media (max-width: 768px) {
          .host-options-display { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
