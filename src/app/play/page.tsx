"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PlayPage() {
  const [pin, setPin] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      router.push(`/play/${pin}`);
    }
  };

  return (
    <div className="play-page">
      <div className="play-bg">
        <div className="play-shape play-shape-1"></div>
        <div className="play-shape play-shape-2"></div>
        <div className="play-shape play-shape-3"></div>
      </div>

      <div className="play-container animate-scale-in">
        <Link href="/" className="navbar-brand" style={{ justifyContent: "center", marginBottom: "var(--space-8)" }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#lg5)" />
            <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs><linearGradient id="lg5" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6C5CE7" /><stop offset="1" stopColor="#00D2FF" /></linearGradient></defs>
          </svg>
          <span style={{ fontSize: "var(--text-3xl)" }}>Quizzit</span>
        </Link>

        <form onSubmit={handleJoin} className="play-form">
          <input
            type="text"
            className="input pin-mega-input"
            placeholder="Game PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            autoFocus
            id="play-pin-input"
            aria-label="Game PIN"
          />
          <button
            type="submit"
            className="btn btn-primary btn-xl"
            style={{ width: "100%", fontSize: "var(--text-xl)", padding: "var(--space-5)" }}
            disabled={pin.length !== 6}
            id="play-join-btn"
          >
            Enter
          </button>
        </form>
      </div>

      <style jsx>{`
        .play-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          position: relative;
          overflow: hidden;
        }
        .play-bg { position: absolute; inset: 0; pointer-events: none; }
        .play-shape { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.3; }
        .play-shape-1 { width: 600px; height: 600px; background: var(--primary); top: -200px; left: -100px; animation: float 10s ease-in-out infinite; }
        .play-shape-2 { width: 500px; height: 500px; background: var(--secondary); bottom: -200px; right: -100px; animation: float 12s ease-in-out infinite reverse; }
        .play-shape-3 { width: 300px; height: 300px; background: var(--accent); top: 50%; left: 50%; animation: float 8s ease-in-out infinite; }
        .play-container {
          text-align: center;
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
        }
        .play-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .pin-mega-input {
          font-family: var(--font-mono) !important;
          font-size: 3rem !important;
          text-align: center !important;
          letter-spacing: 0.4em !important;
          font-weight: 800 !important;
          padding: var(--space-6) !important;
          border-radius: var(--radius-2xl) !important;
          background: var(--bg-secondary) !important;
        }
      `}</style>
    </div>
  );
}
