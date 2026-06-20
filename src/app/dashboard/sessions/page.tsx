"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SessionItem {
  id: string;
  pin: string;
  status: string;
  mode: string;
  createdAt: string;
  quiz: { id: string; title: string };
  _count: { players: number; responses: number };
}

export default function SessionsListPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => { setSessions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    LOBBY: "badge-warning",
    IN_PROGRESS: "badge-info",
    COMPLETED: "badge-success",
    CANCELLED: "badge-error",
    PAUSED: "badge-warning",
  };

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <div className="flex items-center gap-3" style={{ width: "100%" }}>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">← Back</Link>
          <h2 className="font-display" style={{ fontSize: "var(--text-lg)" }}>Session History</h2>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: "var(--space-16)" }}>
            <div className="spinner"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-secondary)" }}>
            <p>No sessions yet. Host a quiz to see session history here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 stagger-children">
            {sessions.map((session) => (
              <Link key={session.id} href={`/dashboard/sessions/${session.id}`} className="card card-interactive">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display" style={{ fontWeight: 700, marginBottom: "var(--space-1)" }}>
                      {session.quiz.title}
                    </h3>
                    <div className="flex items-center gap-3" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                      <span>PIN: {session.pin}</span>
                      <span>👥 {session._count.players} players</span>
                      <span>📝 {session._count.responses} responses</span>
                      <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`badge ${statusColors[session.status] || "badge-primary"}`}>
                    {session.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
