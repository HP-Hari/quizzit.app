"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.title = "Sign In — Quizzit";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "true") {
        Promise.resolve().then(() => {
          setSuccessMessage("Your password has been successfully reset. Please sign in with your new password.");
        });
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
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
              <rect width="32" height="32" rx="8" fill="url(#logo-grad2)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logo-grad2" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6C5CE7" />
                  <stop offset="1" stopColor="#00D2FF" />
                </linearGradient>
              </defs>
            </svg>
            <span>Quizzit</span>
          </Link>
          <h1 className="auth-title font-display">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {successMessage && (
            <div className="auth-success animate-fade-in" style={{
              background: "rgba(46, 204, 113, 0.1)",
              border: "1px solid rgba(46, 204, 113, 0.3)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-3) var(--space-4)",
              color: "var(--success)",
              fontSize: "var(--text-sm)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)"
            }}>
              <span>✅</span> {successMessage}
            </div>
          )}

          {error && (
            <div className="auth-error animate-fade-in">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="login-email" className="input-label">Email</label>
            <input
              id="login-email"
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
            <div className="flex items-center justify-between" style={{ width: "100%", marginBottom: "2px" }}>
              <label htmlFor="login-password" className="input-label" style={{ marginBottom: 0 }}>Password</label>
              <Link href="/forgot-password" style={{ fontSize: "var(--text-xs)", color: "var(--primary-light)", fontWeight: 500 }}>
                Forgot Password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? <span className="spinner spinner-sm"></span> : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "var(--primary-light)", fontWeight: 600 }}>
              Sign up free
            </Link>
          </p>
          <p style={{ marginTop: "var(--space-3)" }}>
            <Link href="/play" style={{ color: "var(--text-tertiary)", fontWeight: 500, fontSize: "var(--text-sm)" }}>
              🎮 Continue as Guest →
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

        .auth-bg-shapes {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .auth-shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.3;
        }

        .auth-shape-1 {
          width: 500px;
          height: 500px;
          background: var(--primary);
          top: -200px;
          right: -100px;
        }

        .auth-shape-2 {
          width: 400px;
          height: 400px;
          background: var(--secondary);
          bottom: -150px;
          left: -100px;
        }

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

        .auth-header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .auth-title {
          font-size: var(--text-2xl);
          font-weight: 800;
          margin-top: var(--space-5);
          margin-bottom: var(--space-2);
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .auth-error {
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          color: var(--error);
          font-size: var(--text-sm);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .auth-footer {
          text-align: center;
          margin-top: var(--space-6);
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
      `}</style>
    </div>
  );
}
