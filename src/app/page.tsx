"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const [pin, setPin] = useState("");
  const router = useRouter();

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      router.push(`/play/${pin}`);
    }
  };

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="container flex items-center justify-between" style={{ maxWidth: "100%", padding: "0 2rem" }}>
          <Link href="/" className="navbar-brand">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6C5CE7" />
                  <stop offset="1" stopColor="#00D2FF" />
                </linearGradient>
              </defs>
            </svg>
            <span>Quizzit</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="btn btn-ghost">Log In</Link>
            <Link href="/register" className="btn btn-primary">Sign Up Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>

        <div className="container text-center" style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-badge animate-fade-in-down">
            <span className="badge badge-primary">✨ Next-Gen Quiz Platform</span>
          </div>

          <h1 className="hero-title animate-fade-in-up font-display">
            Make Learning <br />
            <span className="text-gradient">Unforgettable</span>
          </h1>

          <p className="hero-subtitle animate-fade-in-up">
            Create stunning interactive quizzes, polls, and presentations.<br />
            Engage thousands of participants in real-time with gamified scoring.
          </p>

          {/* Join Game Card */}
          <div className="join-card card-glass animate-scale-in">
            <form onSubmit={handleJoinGame} className="join-form">
              <input
                type="text"
                className="input input-lg pin-input"
                placeholder="Enter Game PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                id="game-pin-input"
                aria-label="Game PIN"
              />
              <button
                type="submit"
                className="btn btn-primary btn-xl"
                disabled={pin.length !== 6}
                id="join-game-btn"
              >
                Join Game →
              </button>
            </form>
            <p className="join-hint">Enter the 6-digit PIN shown on the host&apos;s screen</p>
          </div>

          {/* Or Create */}
          <div className="hero-cta animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <span className="text-secondary" style={{ color: "var(--text-tertiary)" }}>or</span>
            <Link href="/register" className="btn btn-secondary btn-lg" id="create-quiz-btn">
              🎯 Create Your Own Quiz
            </Link>
            <Link href="/play" className="btn btn-ghost btn-lg" id="play-guest-btn" style={{ borderColor: "var(--border-light)" }}>
              🎮 Play as Guest
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title font-display text-center">
            Everything You Need to <span className="text-gradient">Engage</span>
          </h2>
          <p className="section-subtitle text-center">
            A complete platform for interactive education and team engagement
          </p>

          <div className="features-grid">
            <div className="feature-card card card-interactive">
              <div className="feature-icon" style={{ background: "rgba(108, 92, 231, 0.15)" }}>
                ⚡
              </div>
              <h3>Real-Time Gaming</h3>
              <p>Host-controlled sessions with live countdowns, instant feedback, and gamified scoring. Sub-100ms latency.</p>
            </div>

            <div className="feature-card card card-interactive">
              <div className="feature-icon" style={{ background: "rgba(0, 210, 255, 0.15)" }}>
                🧠
              </div>
              <h3>AI Quiz Generation</h3>
              <p>Generate balanced quizzes from any topic description using AI. Create content in seconds, not hours.</p>
            </div>

            <div className="feature-card card card-interactive">
              <div className="feature-icon" style={{ background: "rgba(81, 207, 102, 0.15)" }}>
                📊
              </div>
              <h3>Rich Analytics</h3>
              <p>Detailed post-session reports with per-question accuracy, individual performance, and CSV exports.</p>
            </div>

            <div className="feature-card card card-interactive">
              <div className="feature-icon" style={{ background: "rgba(255, 107, 107, 0.15)" }}>
                👥
              </div>
              <h3>Team Mode</h3>
              <p>Auto-balanced team creation with cooperative scoring. Perfect for classroom collaboration.</p>
            </div>

            <div className="feature-card card card-interactive">
              <div className="feature-icon" style={{ background: "rgba(255, 212, 59, 0.15)" }}>
                🎨
              </div>
              <h3>Content Slides</h3>
              <p>Merge quizzes with Markdown presentations, code snippets, and media for unified interactive lectures.</p>
            </div>

            <div className="feature-card card card-interactive">
              <div className="feature-icon" style={{ background: "rgba(160, 100, 255, 0.15)" }}>
                🔒
              </div>
              <h3>Anti-Cheat Engine</h3>
              <p>Server-authoritative scoring, rate limiting, and input validation. Answers never leak to clients.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Question Types Section */}
      <section className="types-section">
        <div className="container text-center">
          <h2 className="section-title font-display">
            Multiple <span className="text-gradient">Question Types</span>
          </h2>
          <div className="types-grid">
            <div className="type-pill">✅ Multiple Choice</div>
            <div className="type-pill">✔️ True / False</div>
            <div className="type-pill">☑️ Multi-Select</div>
            <div className="type-pill">📝 Open-Ended</div>
            <div className="type-pill">📊 Live Polls</div>
            <div className="type-pill">☁️ Word Clouds</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container text-center">
          <div className="cta-card card-glass">
            <h2 className="font-display" style={{ fontSize: "var(--text-4xl)", marginBottom: "var(--space-4)" }}>
              Ready to make learning <span className="text-gradient">interactive</span>?
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-8)", fontSize: "var(--text-lg)" }}>
              Join thousands of educators and presenters using Quizzit
            </p>
            <Link href="/register" className="btn btn-primary btn-xl" id="cta-signup-btn">
              Get Started — It&apos;s Free 🚀
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container text-center">
          <div className="navbar-brand" style={{ justifyContent: "center", marginBottom: "var(--space-4)" }}>
            <span>Quizzit</span>
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            © {new Date().getFullYear()} Quizzit. Built with ❤️ for interactive learning.
          </p>
        </div>
      </footer>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
        }

        .hero-section {
          position: relative;
          padding: 8rem 0 6rem;
          overflow: hidden;
        }

        .hero-bg-shapes {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
        }

        .shape-1 {
          width: 400px;
          height: 400px;
          background: var(--primary);
          top: -100px;
          left: -100px;
          animation: float 8s ease-in-out infinite;
        }

        .shape-2 {
          width: 300px;
          height: 300px;
          background: var(--secondary);
          top: 50%;
          right: -50px;
          animation: float 10s ease-in-out infinite reverse;
        }

        .shape-3 {
          width: 250px;
          height: 250px;
          background: var(--accent);
          bottom: -50px;
          left: 40%;
          animation: float 12s ease-in-out infinite;
        }

        .hero-badge {
          margin-bottom: var(--space-6);
        }

        .hero-title {
          font-size: clamp(2.5rem, 6vw, 5rem);
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: var(--space-6);
          letter-spacing: -0.02em;
        }

        .hero-subtitle {
          font-size: var(--text-xl);
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto var(--space-10);
          line-height: 1.6;
        }

        .join-card {
          max-width: 500px;
          margin: 0 auto;
          padding: var(--space-8);
        }

        .join-form {
          display: flex;
          gap: var(--space-3);
        }

        .pin-input {
          font-family: var(--font-mono);
          font-size: var(--text-2xl) !important;
          text-align: center;
          letter-spacing: 0.3em;
          font-weight: 700;
        }

        .join-hint {
          margin-top: var(--space-3);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        }

        .hero-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          margin-top: var(--space-6);
        }

        .features-section {
          padding: 6rem 0;
        }

        .section-title {
          font-size: var(--text-4xl);
          font-weight: 800;
          margin-bottom: var(--space-4);
        }

        .section-subtitle {
          font-size: var(--text-lg);
          color: var(--text-secondary);
          margin-bottom: var(--space-12);
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-6);
        }

        .feature-card {
          padding: var(--space-8);
          text-align: left;
        }

        .feature-card h3 {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .feature-card p {
          color: var(--text-secondary);
          font-size: var(--text-sm);
          line-height: 1.7;
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-2xl);
          margin-bottom: var(--space-5);
        }

        .types-section {
          padding: 4rem 0 6rem;
        }

        .types-grid {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          justify-content: center;
          margin-top: var(--space-8);
        }

        .type-pill {
          padding: var(--space-3) var(--space-6);
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-full);
          font-weight: 600;
          font-size: var(--text-sm);
          transition: all var(--transition-base);
        }

        .type-pill:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-glow-sm);
        }

        .cta-section {
          padding: 4rem 0 8rem;
        }

        .cta-card {
          padding: var(--space-16);
          border-radius: var(--radius-2xl);
        }

        .footer {
          padding: var(--space-8) 0;
          border-top: 1px solid var(--border-default);
        }

        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr;
          }

          .join-form {
            flex-direction: column;
          }

          .hero-cta {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
