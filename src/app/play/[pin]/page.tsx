"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSocket } from "@/lib/hooks/useSocket";
import { useSession, signIn } from "next-auth/react";

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

type GamePhase = "join" | "lobby" | "question" | "results" | "leaderboard" | "podium";

export default function PlayerGamePage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params);
  const { socket, isConnected, emit, on, off } = useSocket();
  const { data: session } = useSession();

  const [phase, setPhase] = useState<GamePhase>("join");
  const [nickname, setNickname] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState("");

  // Guest saving states
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveEmail, setSaveEmail] = useState("");
  const [savePassword, setSavePassword] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Game state
  const [currentSlide, setCurrentSlide] = useState<SlideData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number; streak: number; totalScore: number } | null>(null);
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState(0);
  const [myScore, setMyScore] = useState(0);

  // Podium
  const [podium, setPodium] = useState<{ rank: number; nickname: string; score: number }[]>([]);

  // Word cloud
  const [wordInput, setWordInput] = useState("");

  // Answer count
  const [answerCount, setAnswerCount] = useState({ count: 0, total: 0 });

  const userId = session?.user ? (session.user as { id?: string }).id : undefined;

  const handleJoin = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setError("");
    emit("lobby:join", { pin, nickname: nickname.trim(), userId });
  }, [nickname, pin, emit, userId]);

  // Warning on closing tab/leaving page for guest users
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isGuest = !session?.user;
      if (nickname.trim() && isGuest && !saveSuccess) {
        e.preventDefault();
        e.returnValue = "You have unsaved game data. If you leave now, your score and achievements will be lost.";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [nickname, session, saveSuccess]);

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaveLoading(true);

    try {
      const res = await fetch("/api/auth/claim-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName || nickname,
          email: saveEmail,
          password: savePassword,
          sessionPlayerId: myPlayerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to save progress");
        return;
      }

      // Log the user in automatically
      const signInResult = await signIn("credentials", {
        email: saveEmail,
        password: savePassword,
        redirect: false,
      });

      if (signInResult?.error) {
        setSaveError("Account created, but automatic sign in failed. Please log in manually.");
      } else {
        setSaveSuccess(true);
      }
    } catch (err) {
      setSaveError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handlers: [string, (...args: unknown[]) => void][] = [
      ["lobby:player_list", ((data: { players: Player[]; yourId?: string }) => {
        setPlayers(data.players);
        if (data.yourId) {
          setMyPlayerId(data.yourId);
        }
        setPhase("lobby");
      }) as (...args: unknown[]) => void],
      ["lobby:player_joined", ((data: { player: Player }) => {
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
        setSelectedOptions([]);
        setHasAnswered(false);
        setAnswerResult(null);
        setCorrectOptionIds([]);
        setPhase("question");
        setAnswerCount({ count: 0, total: 0 });
        setWordInput("");
      }) as (...args: unknown[]) => void],
      ["game:countdown", ((data: { secondsRemaining: number }) => {
        setTimeRemaining(data.secondsRemaining);
      }) as (...args: unknown[]) => void],
      ["game:answer_ack", ((data: { isCorrect?: boolean; points?: number; streak?: number; totalScore?: number }) => {
        if (data.isCorrect !== undefined) {
          setAnswerResult({
            isCorrect: data.isCorrect,
            points: data.points || 0,
            streak: data.streak || 0,
            totalScore: data.totalScore || 0,
          });
          setMyScore(data.totalScore || 0);
        }
      }) as (...args: unknown[]) => void],
      ["game:answer_count", ((data: { count: number; total: number }) => {
        setAnswerCount(data);
      }) as (...args: unknown[]) => void],
      ["game:time_up", (() => {}) as (...args: unknown[]) => void],
      ["game:results", ((data: { correctOptionIds: string[] }) => {
        setCorrectOptionIds(data.correctOptionIds || []);
        setPhase("results");
      }) as (...args: unknown[]) => void],
      ["game:leaderboard", ((data: { top10: LeaderboardEntry[]; yourRank: number; yourScore: number }) => {
        setLeaderboard(data.top10);
        setMyRank(data.yourRank);
        setMyScore(data.yourScore);
        setPhase("leaderboard");
      }) as (...args: unknown[]) => void],
      ["game:podium", ((data: { podium: { rank: number; nickname: string; score: number }[] }) => {
        setPodium(data.podium);
        setPhase("podium");
      }) as (...args: unknown[]) => void],
      ["wordcloud:update", (() => {}) as (...args: unknown[]) => void],
      ["error", ((data: { message: string }) => {
        setError(data.message);
      }) as (...args: unknown[]) => void],
    ];

    handlers.forEach(([event, handler]) => on(event, handler));
    return () => {
      handlers.forEach(([event, handler]) => off(event, handler));
    };
  }, [socket, on, off]);

  function selectOption(optionId: string) {
    if (hasAnswered) return;
    const qType = currentSlide?.questionType;

    if (qType === "MULTI_SELECT") {
      setSelectedOptions((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
      // Auto-submit for MCQ/TRUE_FALSE
      setHasAnswered(true);
      emit("game:answer", {
        slideIndex: currentSlide?.slideIndex,
        selectedOptionIds: [optionId],
      });
    }
  }

  function submitMultiSelect() {
    if (hasAnswered || selectedOptions.length === 0) return;
    setHasAnswered(true);
    emit("game:answer", {
      slideIndex: currentSlide?.slideIndex,
      selectedOptionIds: selectedOptions,
    });
  }

  function submitWordCloud() {
    if (hasAnswered || !wordInput.trim()) return;
    const words = wordInput.split(",").map((w) => w.trim()).filter(Boolean).slice(0, 5);
    setHasAnswered(true);
    emit("wordcloud:submit", { slideIndex: currentSlide?.slideIndex, words });
  }

  const answerColors = ["answer-a", "answer-b", "answer-c", "answer-d"];

  return (
    <div className="player-page">
      {/* JOIN PHASE */}
      {phase === "join" && (
        <div className="player-center animate-scale-in">
          <div className="pin-display" style={{ marginBottom: "var(--space-6)" }}>
            PIN: {pin}
          </div>
          <form onSubmit={handleJoin} className="flex flex-col gap-4" style={{ width: "100%", maxWidth: "360px" }}>
            {error && <div className="auth-error animate-fade-in"><span>⚠️</span> {error}</div>}
            <input
              type="text"
              className="input input-lg"
              placeholder="Your Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              maxLength={20}
              autoFocus
              id="nickname-input"
              style={{ textAlign: "center", fontSize: "var(--text-xl)", fontWeight: 700 }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-xl"
              disabled={!nickname.trim() || !isConnected}
              id="join-btn"
            >
              {isConnected ? "Join Game! 🎮" : "Connecting..."}
            </button>
          </form>
        </div>
      )}

      {/* LOBBY PHASE */}
      {phase === "lobby" && (
        <div className="player-center animate-fade-in">
          <div className="animate-float" style={{ fontSize: "4rem", marginBottom: "var(--space-4)" }}>🎮</div>
          <h2 className="font-display" style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-2)" }}>You&apos;re In!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "var(--text-lg)" }}>
            Waiting for the host to start...
          </p>
          <div className="badge badge-primary" style={{ fontSize: "var(--text-base)", padding: "var(--space-2) var(--space-4)" }}>
            {players.length} player{players.length !== 1 ? "s" : ""} joined
          </div>
          <div className="player-avatars">
            {players.slice(0, 20).map((p) => (
              <div key={p.id} className="avatar avatar-sm" title={p.nickname}>
                {p.nickname[0].toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUESTION PHASE */}
      {phase === "question" && currentSlide && (
        <div className="question-screen animate-fade-in">
          {/* Timer Bar */}
          <div className="timer-bar">
            <div
              className="timer-fill"
              style={{
                width: `${(timeRemaining / (currentSlide.timeLimit || 30)) * 100}%`,
                background: timeRemaining <= 5 ? "var(--error)" : timeRemaining <= 10 ? "var(--warning)" : "var(--primary)",
              }}
            ></div>
          </div>

          <div className="question-header">
            <span className="badge badge-primary">
              {currentSlide.slideIndex + 1} / {currentSlide.totalSlides}
            </span>
            <div className="countdown-number" style={{ fontSize: "var(--text-2xl)" }}>
              {timeRemaining}s
            </div>
          </div>

          {/* Question */}
          <div className="question-text-area">
            <h2 className="font-display" style={{ fontSize: "var(--text-2xl)", textAlign: "center", lineHeight: 1.4 }}>
              {currentSlide.questionText || currentSlide.title}
            </h2>
            {currentSlide.codeSnippet && (
              <pre className="code-block">
                <code>{currentSlide.codeSnippet}</code>
              </pre>
            )}
          </div>

          {/* Word Cloud Input */}
          {currentSlide.slideType === "WORD_CLOUD" && !hasAnswered && (
            <div className="flex flex-col gap-3" style={{ padding: "0 var(--space-6)", maxWidth: 500, margin: "0 auto", width: "100%" }}>
              <input
                type="text"
                className="input input-lg"
                placeholder="Enter words (comma-separated)"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                style={{ textAlign: "center" }}
              />
              <button className="btn btn-primary btn-lg" onClick={submitWordCloud}>Submit Words</button>
            </div>
          )}

          {/* Answer Buttons */}
          {hasAnswered ? (
            <div className="answered-state animate-scale-in">
              {answerResult ? (
                <div className="answer-feedback">
                  <div className={`feedback-icon ${answerResult.isCorrect ? "correct" : "incorrect"}`}>
                    {answerResult.isCorrect ? "✅" : "❌"}
                  </div>
                  <h3 className="font-display" style={{ fontSize: "var(--text-2xl)" }}>
                    {answerResult.isCorrect ? "Correct!" : "Not quite!"}
                  </h3>
                  {answerResult.points > 0 && (
                    <div className="points-earned">+{answerResult.points} pts</div>
                  )}
                  {answerResult.streak > 1 && (
                    <div className="streak-indicator">🔥 {answerResult.streak} streak!</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "3rem" }}>✓</div>
              )}
              <p style={{ color: "var(--text-secondary)" }}>
                {answerCount.count}/{answerCount.total} answered
              </p>
            </div>
          ) : currentSlide.options.length > 0 && (
            <div className="answer-area">
              <div className="answer-grid">
                {currentSlide.options.map((opt, idx) => (
                  <button
                    key={opt.id}
                    className={`answer-btn ${answerColors[idx % 4]} ${selectedOptions.includes(opt.id) ? "selected" : ""}`}
                    onClick={() => selectOption(opt.id)}
                    id={`answer-${idx}`}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
              {currentSlide.questionType === "MULTI_SELECT" && (
                <button
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: "var(--space-4)", width: "100%" }}
                  onClick={submitMultiSelect}
                  disabled={selectedOptions.length === 0}
                >
                  Submit Selection ({selectedOptions.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* RESULTS PHASE */}
      {phase === "results" && currentSlide && (
        <div className="player-center animate-fade-in">
          <h2 className="font-display" style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-4)" }}>Results</h2>
          <div className="answer-grid" style={{ maxWidth: 500, opacity: 0.9 }}>
            {currentSlide.options.map((opt, idx) => (
              <div
                key={opt.id}
                className={`answer-btn ${answerColors[idx % 4]} ${correctOptionIds.includes(opt.id) ? "answer-correct" : "answer-incorrect"}`}
                style={{ cursor: "default" }}
              >
                {opt.text}
                {correctOptionIds.includes(opt.id) && " ✓"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD PHASE */}
      {phase === "leaderboard" && (
        <div className="player-center animate-fade-in-up" style={{ width: "100%", maxWidth: 500, padding: "0 var(--space-4)" }}>
          <h2 className="font-display" style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-6)" }}>🏆 Leaderboard</h2>

          <div className="my-rank-card card" style={{ marginBottom: "var(--space-6)", textAlign: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Your Position</span>
            <div className="font-display" style={{ fontSize: "var(--text-4xl)", fontWeight: 800, color: "var(--primary-light)" }}>
              #{myRank}
            </div>
            <div className="font-mono" style={{ color: "var(--secondary)" }}>{myScore} pts</div>
          </div>

          <div className="flex flex-col gap-3 stagger-children">
            {leaderboard.map((entry) => (
              <div key={entry.playerId} className="leaderboard-item">
                <span className="leaderboard-rank">{entry.rank}</span>
                <div className="avatar avatar-sm">{entry.nickname[0].toUpperCase()}</div>
                <span style={{ fontWeight: 600, flex: 1 }}>{entry.nickname}</span>
                <span className="leaderboard-score">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PODIUM PHASE */}
      {phase === "podium" && (
        <div className="player-center animate-fade-in">
          <h2 className="font-display text-gradient" style={{ fontSize: "var(--text-4xl)", marginBottom: "var(--space-8)" }}>
            🎉 Final Results!
          </h2>

          <div className="podium-container">
            {podium.length >= 2 && (
              <div className="podium-place">
                <div className="avatar avatar-lg">{podium[1].nickname[0].toUpperCase()}</div>
                <div className="font-bold">{podium[1].nickname}</div>
                <div className="font-mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{podium[1].score} pts</div>
                <div className="podium-bar podium-2nd">🥈</div>
              </div>
            )}
            {podium.length >= 1 && (
              <div className="podium-place">
                <div className="avatar avatar-xl" style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)" }}>{podium[0].nickname[0].toUpperCase()}</div>
                <div className="font-bold">{podium[0].nickname}</div>
                <div className="font-mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{podium[0].score} pts</div>
                <div className="podium-bar podium-1st">🥇</div>
              </div>
            )}
            {podium.length >= 3 && (
              <div className="podium-place">
                <div className="avatar avatar-lg">{podium[2].nickname[0].toUpperCase()}</div>
                <div className="font-bold">{podium[2].nickname}</div>
                <div className="font-mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{podium[2].score} pts</div>
                <div className="podium-bar podium-3rd">🥉</div>
              </div>
            )}
          </div>

          <div className="my-rank-card card" style={{ marginTop: "var(--space-8)", textAlign: "center", maxWidth: 300 }}>
            <span style={{ color: "var(--text-secondary)" }}>Your Final Score</span>
            <div className="font-display" style={{ fontSize: "var(--text-3xl)", color: "var(--primary-light)" }}>#{myRank}</div>
            <div className="font-mono" style={{ fontSize: "var(--text-xl)", color: "var(--secondary)" }}>{myScore} pts</div>
          </div>

          {/* Guest Save Progress Card */}
          {!session?.user && (
            <div className="card card-glass animate-fade-in-up" style={{ marginTop: "var(--space-6)", padding: "var(--space-6)", maxWidth: 400, width: "100%", textAlign: "center" }}>
              {saveSuccess ? (
                <div>
                  <h3 className="font-display" style={{ color: "var(--success)", fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>✅ Progress Saved!</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Your account has been created. You can now log in using your email to view your stats.</p>
                </div>
              ) : (
                <div>
                  <h3 className="font-display" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>Save your results? 🎯</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>Create a free account to persist your scores, track your performance, and host your own quizzes!</p>
                  <button className="btn btn-primary" onClick={() => {
                    if (!saveName) setSaveName(nickname);
                    setShowSaveModal(true);
                  }}>
                    Create Account & Save
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Progress Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title font-display">Save Your Progress 🚀</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowSaveModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSaveProgress} className="flex flex-col gap-4">
              {saveError && (
                <div className="auth-error animate-fade-in">
                  <span>⚠️</span> {saveError}
                </div>
              )}
              
              <div className="input-group">
                <label className="input-label" htmlFor="save-name">Full Name</label>
                <input
                  id="save-name"
                  type="text"
                  className="input"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="save-email">Email Address</label>
                <input
                  id="save-email"
                  type="email"
                  className="input"
                  value={saveEmail}
                  onChange={(e) => setSaveEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="save-password">Password</label>
                <input
                  id="save-password"
                  type="password"
                  className="input"
                  value={savePassword}
                  onChange={(e) => setSavePassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                disabled={saveLoading}
              >
                {saveLoading ? <span className="spinner spinner-sm"></span> : "Save Progress & Sign In"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .player-page { min-height: 100vh; display: flex; flex-direction: column; }
        .player-center { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; min-height: 100vh; padding: var(--space-6); }
        .player-avatars { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; margin-top: var(--space-4); }
        .question-screen { display: flex; flex-direction: column; min-height: 100vh; }
        .timer-bar { width: 100%; height: 6px; background: var(--bg-tertiary); }
        .timer-fill { height: 100%; transition: width 1s linear; border-radius: 0 var(--radius-full) var(--radius-full) 0; }
        .question-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-6); }
        .question-text-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-6); gap: var(--space-4); }
        .code-block { background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-4); font-family: var(--font-mono); font-size: var(--text-sm); overflow-x: auto; width: 100%; max-width: 600px; }
        .answer-area { padding: var(--space-4); }
        .answered-state { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: var(--space-8); gap: var(--space-3); }
        .answer-feedback { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-3); }
        .feedback-icon { font-size: 4rem; animation: bounceIn 0.5s ease; }
        .points-earned { font-family: var(--font-mono); font-size: var(--text-3xl); font-weight: 800; color: var(--success); animation: fadeInUp 0.3s ease; }
        .streak-indicator { font-size: var(--text-lg); font-weight: 700; color: var(--warning); animation: fadeInUp 0.4s ease; }
        .my-rank-card { padding: var(--space-5); }
        .auth-error { background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); color: var(--error); font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-2); }
      `}</style>
    </div>
  );
}
