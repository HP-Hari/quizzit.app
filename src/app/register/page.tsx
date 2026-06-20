"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.title = "Create Account — Quizzit";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Auto-login after registration
      router.push("/login?registered=true");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-shapes">
        <div className="auth-shape auth-shape-1"></div>
        <div className="auth-shape auth-shape-2"></div>
      </div>

      <div className="auth-container animate-scale-in">
        <div className="auth-header">
          <Link href="/" className="navbar-brand" style={{ justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad3)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logo-grad3" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6C5CE7" />
                  <stop offset="1" stopColor="#00D2FF" />
                </linearGradient>
              </defs>
            </svg>
            <span>Quizzit</span>
          </Link>
          <h1 className="auth-title font-display">Create Account</h1>
          <p className="auth-subtitle">Start creating interactive quizzes today</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error animate-fade-in">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="register-name" className="input-label">Full Name</label>
            <input
              id="register-name"
              type="text"
              className="input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-email" className="input-label">Email</label>
            <input
              id="register-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-password" className="input-label">Password</label>
            <input
              id="register-password"
              type="password"
              className="input"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              Must be at least 8 characters with 1 uppercase letter and 1 number
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={loading}
            id="register-submit-btn"
          >
            {loading ? <span className="spinner spinner-sm"></span> : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--primary-light)", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
          <p style={{ marginTop: "var(--space-3)" }}>
            <Link href="/play" style={{ color: "var(--text-tertiary)", fontWeight: 500, fontSize: "var(--text-sm)" }}>
              🎮 Just want to play? Continue as Guest →
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          position: relative;
          overflow: hidden;
        }
        .auth-bg-shapes { position: absolute; inset: 0; pointer-events: none; }
        .auth-shape { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.3; }
        .auth-shape-1 { width: 500px; height: 500px; background: var(--primary); top: -200px; right: -100px; }
        .auth-shape-2 { width: 400px; height: 400px; background: var(--secondary); bottom: -150px; left: -100px; }
        .auth-container {
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-2xl);
          padding: var(--space-10);
          width: 100%;
          max-width: 440px;
          box-shadow: var(--shadow-2xl);
          position: relative;
          z-index: 1;
        }
        .auth-header { text-align: center; margin-bottom: var(--space-8); }
        .auth-title { font-size: var(--text-2xl); font-weight: 800; margin-top: var(--space-5); margin-bottom: var(--space-2); }
        .auth-subtitle { color: var(--text-secondary); font-size: var(--text-sm); }
        .auth-form { display: flex; flex-direction: column; gap: var(--space-5); }
        .auth-error {
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          color: var(--error);
          font-size: var(--text-sm);
          display: flex; align-items: center; gap: var(--space-2);
        }
        .auth-footer { text-align: center; margin-top: var(--space-6); color: var(--text-secondary); font-size: var(--text-sm); }
      `}</style>
    </div>
  );
}
