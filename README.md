# Quizzit — Enterprise Production Setup

Quizzit is a next-generation real-time interactive quiz and presentation platform built using Next.js, Socket.IO, Redis, and MongoDB.

## Tech Stack & Architecture

- **Frontend & API Gateway**: Next.js (App Router, styled with custom high-fidelity CSS design systems).
- **Real-Time Gameplay Sync**: Standalone Socket.IO server utilizing Redis Adapter for multi-instance scaling.
- **Data Persistence**: MongoDB Replica Set configured for transaction safety.
- **Gateway Server**: Nginx configured as a reverse-proxy and WebSocket buffer-controller.
- **Container Setup**: Multi-stage Docker optimization with Next.js standalone runner.

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (v20+) if running locally

### Environment Variables
Configure your variables in `.env` (or copy `.env.example` to `.env`):
```bash
DATABASE_URL="mongodb://localhost:27017/quizzit?replicaSet=rs0"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-strong-production-random-secret"
GEMINI_API_KEY="your-gemini-api-key"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

---

## Deployment (Production Docker Compose)

To spin up the entire production stack (App, Socket, Redis, MongoDB Replica Set, and Nginx reverse proxy):

```bash
docker-compose up --build -d
```

Nginx will route all incoming traffic on port `80`:
- **Web App / APIs**: Proxied to Next.js on port `3000`.
- **WebSockets (`/socket.io`)**: Proxied to the Socket.IO server on port `3001` with streaming support.

---

## Local Development (Without Containers)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

3. **Push Prisma schema changes**:
   ```bash
   npm run prisma:push
   ```

4. **Start Development Stack**:
   ```bash
   npm run dev:all
   ```
   This concurrently runs the Next.js app (`localhost:3000`) and the WebSocket server (`localhost:3001`).

---

## Features
- **Autosave Engine**: Automatically debounces and autosaves quiz slide changes inside the Editor.
- **AI Quiz Generation**: Integrates with Gemini models to auto-create multiple-choice, true/false, or open-ended slides.
- **Anti-Cheat Mechanics**: Built with server-authoritative scoring calculations.
- **Team Mode**: Auto-assigns dynamic color-coded team sessions.
