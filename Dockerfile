# ==========================================
# STAGE 1: Dependency Builder
# ==========================================
FROM node:26.3.0-alpine AS builder

WORKDIR /app

# Install system utilities needed for compiling native bindings
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Install all packages including devDependencies
RUN npm ci

# Copy application source files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Compile Next.js production bundles and custom Express gateway server
RUN npm run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:26.3.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create a secure, non-privileged system user for process execution
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime assets and standalone builds
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/docs ./docs

# Create database and uploads volumes with secure nodejs ownership
RUN mkdir -p /app/data /app/public/uploads/avatars && \
    chown -R nextjs:nodejs /app

# Switch to non-root system user
USER nextjs

EXPOSE 3000

# Run custom compiled Express gateway server
CMD ["node", "dist/server.js"]
