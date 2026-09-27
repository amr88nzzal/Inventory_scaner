FROM node:22-slim AS builder

WORKDIR /app

# Install openssl and certificates for Prisma & Node build tools
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=prisma/schema.prisma

# Build frontend and compile backend bundle
RUN npm run build

# Runner stage
FROM node:22-slim AS runner

WORKDIR /app

# Install openssl and certificates for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev
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
