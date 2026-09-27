import { PrismaClient } from "@prisma/client";

function buildDatasourceUrl(): string | undefined {
  const original = process.env.DATABASE_URL?.trim();

  // 1. If DATABASE_URL is already a valid postgresql:// or postgres:// URL
  if (original && (original.startsWith("postgresql://") || original.startsWith("postgres://"))) {
    try {
      const parsed = new URL(original);
      parsed.searchParams.set("connection_limit", "25");
      parsed.searchParams.set("pool_timeout", "45");
      parsed.searchParams.set("connect_timeout", "45");
      const url = parsed.toString();
      process.env.DATABASE_URL = url;
      return url;
    } catch {
      return original;
    }
  }

  // 2. If Cloud SQL credentials are available in environment (e.g., when DATABASE_URL was set to a plain database name or omitted)
  const adminUser = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
  const adminPass = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;
  const host = process.env.SQL_HOST;
  const dbName = process.env.SQL_DB_NAME || "cloud_sql_development_database";

  if (adminUser && adminPass && host) {
    const constructed = `postgresql://${encodeURIComponent(adminUser)}:${encodeURIComponent(adminPass)}@localhost/${dbName}?host=${encodeURIComponent(host)}&connection_limit=25&pool_timeout=45&connect_timeout=45`;
    process.env.DATABASE_URL = constructed;
    return constructed;
  }

  return original || undefined;
}

const dbUrl = buildDatasourceUrl();

// Base Prisma Client with configured datasource URL
const basePrisma = new PrismaClient(
  dbUrl
    ? {
        datasources: {
          db: {
            url: dbUrl,
          },
        },
      }
    : undefined
);

function isTransientError(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return (
    code === "P1001" || // Can't reach database server
    code === "P1008" || // Operations timed out
    code === "P1017" || // Server has closed connection
    code === "P2024" || // Timed out fetching a new connection from pool
    msg.includes("can't reach database server") ||
    msg.includes("connection closed") ||
    msg.includes("connection terminated") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout")
  );
}

// Extended client with automatic retry for transient connection drops / scale-to-zero wakeups
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
          try {
            return await query(args);
          } catch (err: any) {
            attempts++;
            if (isTransientError(err) && attempts < maxAttempts) {
              const backoff = attempts * 1500;
              console.warn(
                `[Prisma Transient Warning] Retrying ${model}.${operation} (attempt ${attempts}/${maxAttempts}) after ${backoff}ms due to: ${err.code || err.message}`
              );
              await new Promise((resolve) => setTimeout(resolve, backoff));
              continue;
            }
            throw err;
          }
        }
      },
    },
    async $queryRaw({ args, query }) {
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          return await query(args);
        } catch (err: any) {
          attempts++;
          if (isTransientError(err) && attempts < maxAttempts) {
            const backoff = attempts * 1500;
            console.warn(
              `[Prisma Transient Warning] Retrying $queryRaw (attempt ${attempts}/${maxAttempts}) after ${backoff}ms due to: ${err.code || err.message}`
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
          }
          throw err;
        }
      }
    },
  },
});


