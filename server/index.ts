import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { calculateScore } from "../src/lib/utils";

const prisma = new PrismaClient();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Configure Redis adapter if REDIS_URL is provided for horizontal scaling
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log(`[REDIS] Horizontal scaling adapter initialized successfully using Redis.`);
  }).catch((err) => {
    console.error("[REDIS] Failed to initialize Redis scaling adapter:", err);
  });
}

// ============================================
// In-Memory Game State (Ephemeral)
// ============================================

interface GameState {
  sessionId: string;
  quizId: string;
  hostSocketId: string;
  status: "LOBBY" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
  currentSlideIndex: number;
  slides: SlideData[];
  players: Map<string, PlayerState>;
  leaderboard: LeaderboardEntry[];
  timerInterval: ReturnType<typeof setInterval> | null;
  timeRemaining: number;
  answersReceived: number;
  slideStartTime: number;
  teamMode: boolean;
  teams: Map<string, TeamState>;
  wordCloudWords: Map<string, number>;
  pollVotes: Map<string, number>;
}

interface SlideData {
  id: string;
  slideType: string;
  questionText: string | null;
  questionType: string | null;
  title: string | null;
  bodyMarkdown: string | null;
  mediaUrl: string | null;
  timeLimitSec: number;
  pointsBase: number;
  codeSnippet: string | null;
  codeLanguage: string | null;
  options: { id: string; text: string; isCorrect: boolean; orderIndex: number }[];
}

interface PlayerState {
  id: string; // SessionPlayer DB ID
  socketId: string;
  nickname: string;
  avatarSeed: string;
  totalScore: number;
  streak: number;
  hasAnswered: boolean;
  teamId: string | null;
}

interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  streak: number;
}

interface TeamState {
  id: string;
  name: string;
  colorHex: string;
  totalScore: number;
}

// Session PIN → GameState
const activeGames = new Map<string, GameState>();
// Socket ID → PIN (for disconnect cleanup)
const socketToPin = new Map<string, string>();
// Socket ID → player role
const socketRole = new Map<string, "host" | "player">();

// ============================================
// Rate Limiting
// ============================================
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(socketId: string, maxPerSec: number = 10): boolean {
  const now = Date.now();
  const limit = rateLimits.get(socketId);
  if (!limit || now > limit.resetAt) {
    rateLimits.set(socketId, { count: 1, resetAt: now + 1000 });
    return true;
  }
  limit.count++;
  if (limit.count > maxPerSec) {
    return false;
  }
  return true;
}

// ============================================
// Socket.IO Connection Handler
// ============================================

io.on("connection", (socket: Socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // ---- LOBBY EVENTS ----

  socket.on("lobby:create", async (data: { sessionId: string; pin: string }) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit("rate_limited", { retryAfter: 1000 });
        return;
      }

      const { sessionId, pin } = data;

      // Fetch session + quiz data from DB
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          quiz: {
            include: {
              slides: {
                include: { options: { orderBy: { orderIndex: "asc" } } },
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      });

      if (!session) {
        socket.emit("error", { code: "SESSION_NOT_FOUND", message: "Session not found" });
        return;
      }

      const slides: SlideData[] = session.quiz.slides.map((s) => ({
        id: s.id,
        slideType: s.slideType,
        questionText: s.questionText,
        questionType: s.questionType,
        title: s.title,
        bodyMarkdown: s.bodyMarkdown,
        mediaUrl: s.mediaUrl,
        timeLimitSec: s.timeLimitSec || 30,
        pointsBase: s.pointsBase || 1000,
        codeSnippet: s.codeSnippet,
        codeLanguage: s.codeLanguage,
        options: s.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          orderIndex: o.orderIndex,
        })),
      }));

      const gameState: GameState = {
        sessionId,
        quizId: session.quizId,
        hostSocketId: socket.id,
        status: "LOBBY",
        currentSlideIndex: -1,
        slides,
        players: new Map(),
        leaderboard: [],
        timerInterval: null,
        timeRemaining: 0,
        answersReceived: 0,
        slideStartTime: 0,
        teamMode: session.teamMode,
        teams: new Map(),
        wordCloudWords: new Map(),
        pollVotes: new Map(),
      };

      activeGames.set(pin, gameState);
      socketToPin.set(socket.id, pin);
      socketRole.set(socket.id, "host");
      socket.join(pin);

      socket.emit("lobby:created", { sessionId, pin, totalSlides: slides.length });
      console.log(`[LOBBY] Created game ${pin} with ${slides.length} slides`);
    } catch (err) {
      console.error("[lobby:create] Error:", err);
      socket.emit("error", { code: "CREATE_FAILED", message: "Failed to create lobby" });
    }
  });

  socket.on("lobby:join", async (data: { pin: string; nickname: string; avatarSeed?: string; userId?: string }) => {
    try {
      if (!checkRateLimit(socket.id)) {
        socket.emit("rate_limited", { retryAfter: 1000 });
        return;
      }

      const { pin, nickname, avatarSeed, userId } = data;
      const game = activeGames.get(pin);

      if (!game) {
        socket.emit("error", { code: "GAME_NOT_FOUND", message: "Game not found. Check your PIN." });
        return;
      }

      if (game.status !== "LOBBY") {
        socket.emit("error", { code: "GAME_STARTED", message: "Game has already started." });
        return;
      }

      // Check duplicate nickname
      for (const [, player] of game.players) {
        if (player.nickname.toLowerCase() === nickname.toLowerCase()) {
          socket.emit("error", { code: "NICKNAME_TAKEN", message: "Nickname already taken." });
          return;
        }
      }

      // Save to database
      const sessionPlayer = await prisma.sessionPlayer.create({
        data: {
          sessionId: game.sessionId,
          nickname: nickname.substring(0, 20),
          avatarSeed: avatarSeed || Math.random().toString(36).substring(2, 10),
          userId: userId || undefined,
        },
      });

      const playerState: PlayerState = {
        id: sessionPlayer.id,
        socketId: socket.id,
        nickname: sessionPlayer.nickname,
        avatarSeed: sessionPlayer.avatarSeed || "",
        totalScore: 0,
        streak: 0,
        hasAnswered: false,
        teamId: null,
      };

      game.players.set(socket.id, playerState);
      socketToPin.set(socket.id, pin);
      socketRole.set(socket.id, "player");
      socket.join(pin);

      // Send player list to new player
      const playerList = Array.from(game.players.values()).map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatarSeed: p.avatarSeed,
      }));

      socket.emit("lobby:player_list", { players: playerList, yourId: sessionPlayer.id });

      // Broadcast new player to everyone in room
      io.to(pin).emit("lobby:player_joined", {
        player: {
          id: sessionPlayer.id,
          nickname: sessionPlayer.nickname,
          avatarSeed: sessionPlayer.avatarSeed,
        },
        totalPlayers: game.players.size,
      });

      console.log(`[JOIN] ${nickname} joined game ${pin} (${game.players.size} players)`);
    } catch (err) {
      console.error("[lobby:join] Error:", err);
      socket.emit("error", { code: "JOIN_FAILED", message: "Failed to join game" });
    }
  });

  socket.on("lobby:kick", (data: { playerId: string }) => {
    const pin = socketToPin.get(socket.id);
    const game = pin ? activeGames.get(pin) : null;
    if (!game || game.hostSocketId !== socket.id) return;

    for (const [sid, player] of game.players) {
      if (player.id === data.playerId) {
        game.players.delete(sid);
        const kickedSocket = io.sockets.sockets.get(sid);
        if (kickedSocket && pin) {
          kickedSocket.emit("error", { code: "KICKED", message: "You were removed from the game." });
          kickedSocket.leave(pin);
        }
        if (pin) {
          io.to(pin).emit("lobby:player_left", { playerId: data.playerId });
        }
        break;
      }
    }
  });

  // ---- GAME LOOP EVENTS ----

  socket.on("game:start", async () => {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.hostSocketId !== socket.id) return;
    if (game.status !== "LOBBY") return;

    game.status = "IN_PROGRESS";
    game.currentSlideIndex = -1;

    // Update DB
    await prisma.gameSession.update({
      where: { id: game.sessionId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    io.to(pin).emit("game:started", { totalSlides: game.slides.length });
    console.log(`[GAME] Started game ${pin}`);

    // Auto-advance to first slide
    advanceSlide(pin, game);
  });

  socket.on("game:next", () => {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.hostSocketId !== socket.id) return;
    if (game.status !== "IN_PROGRESS") return;

    advanceSlide(pin, game);
  });

  socket.on("game:pause", () => {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.hostSocketId !== socket.id) return;

    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }
    game.status = "PAUSED";
    io.to(pin).emit("game:paused", {});
  });

  socket.on("game:resume", () => {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.hostSocketId !== socket.id) return;

    game.status = "IN_PROGRESS";
    startTimer(pin, game);
    io.to(pin).emit("game:resumed", {});
  });

  socket.on("game:answer", (data: { slideIndex: number; selectedOptionIds?: string[]; openEndedText?: string }) => {
    if (!checkRateLimit(socket.id, 3)) {
      socket.emit("rate_limited", { retryAfter: 1000 });
      return;
    }

    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.status !== "IN_PROGRESS") return;

    const player = game.players.get(socket.id);
    if (!player || player.hasAnswered) return;
    if (data.slideIndex !== game.currentSlideIndex) return;

    const slide = game.slides[game.currentSlideIndex];
    if (!slide) return;

    player.hasAnswered = true;
    game.answersReceived++;

    const responseTimeMs = Date.now() - game.slideStartTime;
    const timeLimitMs = slide.timeLimitSec * 1000;

    let isCorrect = false;

    if (slide.questionType === "MCQ" || slide.questionType === "TRUE_FALSE") {
      const correctOption = slide.options.find((o) => o.isCorrect);
      isCorrect = !!correctOption && data.selectedOptionIds?.includes(correctOption.id) === true;
    } else if (slide.questionType === "MULTI_SELECT") {
      const correctIds = slide.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
      const selectedIds = (data.selectedOptionIds || []).sort();
      isCorrect = correctIds.length === selectedIds.length && correctIds.every((id, i) => id === selectedIds[i]);
    }
    // OPEN_ENDED and POLL don't have correct/incorrect

    if (isCorrect) {
      player.streak++;
    } else if (slide.questionType !== "OPEN_ENDED" && slide.questionType !== "POLL") {
      player.streak = 0;
    }

    const { points, streakBonus } = calculateScore(
      isCorrect,
      responseTimeMs,
      timeLimitMs,
      slide.pointsBase,
      player.streak
    );

    player.totalScore += points;

    // Send personal ack to player
    socket.emit("game:answer_ack", {
      received: true,
      isCorrect,
      points,
      streakBonus,
      streak: player.streak,
      totalScore: player.totalScore,
    });

    // Broadcast answer count (no answer details!)
    io.to(pin).emit("game:answer_count", {
      count: game.answersReceived,
      total: game.players.size,
    });

    // Save response to DB (async, don't await)
    prisma.playerResponse.create({
      data: {
        sessionId: game.sessionId,
        playerId: player.id,
        slideId: slide.id,
        selectedOptionIds: data.selectedOptionIds || [],
        openEndedText: data.openEndedText || null,
        isCorrect,
        pointsAwarded: points,
        responseTimeMs,
        streakBonus,
      },
    }).catch((err: Error) => console.error("[DB] Failed to save response:", err));

    // If everyone answered, end the timer early
    if (game.answersReceived >= game.players.size) {
      endSlide(pin, game);
    }
  });

  // ---- POLL & WORD CLOUD ----

  socket.on("poll:vote", (data: { slideIndex: number; optionId: string }) => {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.status !== "IN_PROGRESS") return;

    const player = game.players.get(socket.id);
    if (!player || player.hasAnswered) return;

    player.hasAnswered = true;
    game.answersReceived++;

    const currentVotes = game.pollVotes.get(data.optionId) || 0;
    game.pollVotes.set(data.optionId, currentVotes + 1);

    const distribution = Object.fromEntries(game.pollVotes);
    io.to(pin).emit("poll:results", { distribution, totalVotes: game.answersReceived });

    socket.emit("game:answer_ack", { received: true });
  });

  socket.on("wordcloud:submit", (data: { slideIndex: number; words: string[] }) => {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    const game = activeGames.get(pin);
    if (!game || game.status !== "IN_PROGRESS") return;

    const player = game.players.get(socket.id);
    if (!player || player.hasAnswered) return;

    player.hasAnswered = true;
    game.answersReceived++;

    // Sanitize and add words
    const sanitizedWords = data.words
      .slice(0, 5)
      .map((w) => w.replace(/<[^>]*>/g, "").trim().toLowerCase().substring(0, 30))
      .filter((w) => w.length > 0);

    for (const word of sanitizedWords) {
      const count = game.wordCloudWords.get(word) || 0;
      game.wordCloudWords.set(word, count + 1);
    }

    const words = Array.from(game.wordCloudWords.entries()).map(([text, weight]) => ({
      text,
      weight,
    }));

    io.to(pin).emit("wordcloud:update", { words });
    socket.emit("game:answer_ack", { received: true });
  });

  // ---- DISCONNECT ----

  socket.on("disconnect", async (reason) => {
    console.log(`[DISCONNECT] ${socket.id} - ${reason}`);
    const pin = socketToPin.get(socket.id);
    const role = socketRole.get(socket.id);

    if (pin && role === "player") {
      const game = activeGames.get(pin);
      if (game) {
        const player = game.players.get(socket.id);
        if (player) {
          // Mark as disconnected but don't remove (allow reconnect)
          game.players.delete(socket.id);
          io.to(pin).emit("lobby:player_left", { playerId: player.id });

          // Update DB
          prisma.sessionPlayer.update({
            where: { id: player.id },
            data: { isConnected: false },
          }).catch((err: Error) => console.error("[DB] Disconnect update failed:", err));
        }
      }
    } else if (pin && role === "host") {
      // Host disconnected — pause the game
      const game = activeGames.get(pin);
      if (game && game.status === "IN_PROGRESS") {
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.timerInterval = null;
        io.to(pin).emit("game:paused", { reason: "Host disconnected" });
      }
    }

    socketToPin.delete(socket.id);
    socketRole.delete(socket.id);
    rateLimits.delete(socket.id);
  });
});

// ============================================
// Game Logic Functions
// ============================================

function advanceSlide(pin: string, game: GameState) {
  // Clear previous timer
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }

  game.currentSlideIndex++;

  // Check if game is over
  if (game.currentSlideIndex >= game.slides.length) {
    endGame(pin, game);
    return;
  }

  const slide = game.slides[game.currentSlideIndex];
  game.answersReceived = 0;
  game.slideStartTime = Date.now();
  game.wordCloudWords.clear();
  game.pollVotes.clear();

  // Reset player answer state
  for (const [, player] of game.players) {
    player.hasAnswered = false;
  }

  // Broadcast slide to room — NEVER include correct answers
  const slidePayload = {
    slideIndex: game.currentSlideIndex,
    slideType: slide.slideType,
    questionText: slide.questionText,
    questionType: slide.questionType,
    title: slide.title,
    bodyMarkdown: slide.bodyMarkdown,
    mediaUrl: slide.mediaUrl,
    codeSnippet: slide.codeSnippet,
    codeLanguage: slide.codeLanguage,
    timeLimit: slide.timeLimitSec,
    totalSlides: game.slides.length,
    options: slide.options.map((o) => ({
      id: o.id,
      text: o.text,
      orderIndex: o.orderIndex,
      // NOTE: isCorrect is NEVER sent to client
    })),
  };

  io.to(pin).emit("game:slide", slidePayload);

  // Start countdown
  game.timeRemaining = slide.timeLimitSec;
  startTimer(pin, game);
}

function startTimer(pin: string, game: GameState) {
  if (game.timerInterval) clearInterval(game.timerInterval);

  game.timerInterval = setInterval(() => {
    game.timeRemaining--;
    io.to(pin).emit("game:countdown", { secondsRemaining: game.timeRemaining });

    if (game.timeRemaining <= 0) {
      endSlide(pin, game);
    }
  }, 1000);
}

function endSlide(pin: string, game: GameState) {
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }

  const slide = game.slides[game.currentSlideIndex];

  io.to(pin).emit("game:time_up", { slideIndex: game.currentSlideIndex });

  // Calculate and send results
  const correctOptionIds = slide.options.filter((o) => o.isCorrect).map((o) => o.id);

  // Build answer distribution
  const distribution: Record<string, number> = {};
  for (const opt of slide.options) {
    distribution[opt.id] = 0;
  }

  // Send results to all — now safe to reveal correct answers
  setTimeout(() => {
    io.to(pin).emit("game:results", {
      slideIndex: game.currentSlideIndex,
      correctOptionIds,
      distribution,
    });

    // Send personalized leaderboard
    setTimeout(() => {
      sendLeaderboard(pin, game);
    }, 1500);
  }, 1000);
}

function sendLeaderboard(pin: string, game: GameState) {
  const sorted = Array.from(game.players.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, index) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.totalScore,
      streak: p.streak,
      rank: index + 1,
    }));

  game.leaderboard = sorted;

  // Send top 10 to everyone
  const top10 = sorted.slice(0, 10);

  // Send personalized data to each player
  for (const [socketId, player] of game.players) {
    const myRank = sorted.findIndex((p) => p.playerId === player.id) + 1;
    io.to(socketId).emit("game:leaderboard", {
      top10,
      yourRank: myRank,
      yourScore: player.totalScore,
    });
  }

  // Also send to host
  io.to(game.hostSocketId).emit("game:leaderboard", {
    top10,
    fullRankings: sorted,
  });
}

async function endGame(pin: string, game: GameState) {
  game.status = "COMPLETED";

  // Calculate final rankings
  const finalRankings = Array.from(game.players.values())
    .sort((a, b) => b.totalScore - a.totalScore);

  const podium = finalRankings.slice(0, 3).map((p, i) => ({
    rank: i + 1,
    playerId: p.id,
    nickname: p.nickname,
    score: p.totalScore,
    streak: p.streak,
  }));

  io.to(pin).emit("game:end", {});

  setTimeout(() => {
    io.to(pin).emit("game:podium", {
      podium,
      totalPlayers: game.players.size,
      totalQuestions: game.slides.filter((s) => s.slideType === "QUESTION").length,
    });

    io.to(pin).emit("game:final_scores", {
      rankings: finalRankings.map((p, i) => ({
        rank: i + 1,
        playerId: p.id,
        nickname: p.nickname,
        score: p.totalScore,
        streak: p.streak,
      })),
    });
  }, 1500);

  // Persist final scores to DB atomically
  try {
    const updates = finalRankings.map((player, i) =>
      prisma.sessionPlayer.update({
        where: { id: player.id },
        data: {
          totalScore: player.totalScore,
          streak: player.streak,
          finalRank: i + 1,
        },
      })
    );

    await prisma.$transaction([
      ...updates,
      prisma.gameSession.update({
        where: { id: game.sessionId },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);
  } catch (err) {
    console.error("[endGame] DB persist error:", err);
  }

  // Cleanup after a delay
  setTimeout(() => {
    activeGames.delete(pin);
    console.log(`[CLEANUP] Game ${pin} removed from memory`);
  }, 60000); // Keep for 1 minute for late requests
}

// ============================================
// Server Start
// ============================================

const PORT = parseInt(process.env.SOCKET_PORT || "3001");

httpServer.listen(PORT, () => {
  console.log(`\n🎮 Quizzit Socket.IO server running on port ${PORT}\n`);
});

// Graceful Shutdown Handler
const shutdown = async () => {
  console.log("\n[SHUTDOWN] Gracefully shutting down Socket.IO server...");
  io.close(() => {
    console.log("[SHUTDOWN] Socket.IO server closed.");
  });
  httpServer.close(async () => {
    console.log("[SHUTDOWN] HTTP server closed.");
    await prisma.$disconnect();
    console.log("[SHUTDOWN] Database disconnected. Exiting.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
