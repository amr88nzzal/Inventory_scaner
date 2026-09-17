import { PrismaClient } from "@prisma/client";

function buildDatasourceUrl(): string | undefined {
  const original = process.env.DATABASE_URL;
  if (!original) return undefined;
  try {
    let url = original;
    // Append pool and timeout parameters if not already present
    if (!url.includes("connection_limit=")) {
      url += (url.includes("?") ? "&" : "?") + "connection_limit=25";
    }
    if (!url.includes("pool_timeout=")) {
      url += "&pool_timeout=35";
    }
    if (!url.includes("connect_timeout=")) {
      url += "&connect_timeout=15";
    }
    process.env.DATABASE_URL = url;
    return url;
  } catch {
    return original;
  }
}

const dbUrl = buildDatasourceUrl();

// Single shared Prisma client instance for the whole app with enlarged connection pool
export const prisma = new PrismaClient(
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

