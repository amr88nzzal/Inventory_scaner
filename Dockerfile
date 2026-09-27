FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=prisma/schema.prisma

# Build frontend and compile backend bundle
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/inventory-app ./inventory-app

# Create persistent uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000

# Entrypoint script: ensures database schema is up-to-date and starts the server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.cjs"]
