FROM node:22-slim AS builder

WORKDIR /app

# Install openssl and certificates for Prisma & Node build tools
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies fresh for container OS/CPU architecture
RUN npm install --include=optional --force

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
COPY package.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev --force
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/inventory-app ./inventory-app

# Create persistent uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000

# Entrypoint script: waits for database readiness, pushes schema, and starts server
CMD ["sh", "-c", "until npx prisma db push --skip-generate; do echo 'Waiting for database connection...' && sleep 3; done && node dist/server.cjs"]
