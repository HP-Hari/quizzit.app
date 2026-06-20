"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.title = "Reset Password — Quizzit";
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || "A 6-digit verification code has been sent to your email.");
        setStep(2);
      } else {
        setError(data.error || "Failed to send verification code.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/login?reset=true");
      } else {
        setError(data.error || "Failed to reset password.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
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
          <h1 className="auth-title font-display">Reset Password</h1>
          <p className="auth-subtitle">
            {step === 1
              ? "Enter your email to receive a 6-digit verification code"
              : "Enter the verification code and your new password"}
          </p>
        </div>

        {error && (
          <div className="auth-error animate-fade-in" style={{ marginBottom: "var(--space-5)" }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {message && (
          <div className="auth-success animate-fade-in" style={{
            background: "rgba(46, 204, 113, 0.1)",
            border: "1px solid rgba(46, 204, 113, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-3) var(--space-4)",
            color: "var(--success)",
            fontSize: "var(--text-sm)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-5)"
          }}>
            <span>✅</span> {message}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="auth-form">
            <div className="input-group">
              <label htmlFor="reset-email" className="input-label">Email Address</label>
              <input
                id="reset-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              disabled={loading}
              id="send-otp-btn"
            >
              {loading ? <span className="spinner spinner-sm"></span> : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="input-group">
              <label htmlFor="reset-otp" className="input-label">Verification Code (OTP)</label>
              <input
                id="reset-otp"
                type="text"
                className="input"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                style={{ textAlign: "center", letterSpacing: "8px", fontSize: "1.2rem", fontWeight: "bold" }}
              />
            </div>

            <div className="input-group">
              <label htmlFor="new-password" className="input-label">New Password</label>
              <input
                id="new-password"
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirm-password" className="input-label">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                className="input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              disabled={loading}
              id="reset-pwd-btn"
            >
              {loading ? <span className="spinner spinner-sm"></span> : "Reset Password"}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ width: "100%", marginTop: "var(--space-2)" }}
              onClick={() => {
                setStep(1);
                setError("");
                setMessage("");
              }}
            >
              ← Back to Step 1
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            Remembered your password?{" "}
            <Link href="/login" style={{ color: "var(--primary-light)", fontWeight: 600 }}>
              Sign In
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
