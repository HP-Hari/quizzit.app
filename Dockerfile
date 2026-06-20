# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_TELEMETRY_DISABLED 1
ENV STANDALONE_BUILD=true
RUN npm run build

# Compile the socket server to JavaScript
RUN npx tsc server/index.ts --outDir dist --module commonjs --target es2020 --esModuleInterop --moduleResolution node --skipLibCheck --resolveJsonModule

# Prune devDependencies to keep the size optimized
RUN npm prune --production

# Stage 3: Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static public directory and standalone server files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy compiled socket server files
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
# Copy pruned node_modules to ensure Socket.IO has all its sub-dependencies
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
# Copy prisma files for runtime DB operations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000
EXPOSE 3001

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Default to running Next.js app
CMD ["node", "server.js"]
