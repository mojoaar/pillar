import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client';

let _db: PrismaClient | undefined;

function createDb(): PrismaClient {
  // Dynamic require to defer adapter loading until runtime, ensuring
  // process.env.DATABASE_URL is available in Next.js SSR sandbox.
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL!,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Proxy-based lazy initialization: adapter is only created on first query,
// after systemd/Next.js has loaded process.env.DATABASE_URL at runtime.
export const db = new Proxy({} as PrismaClient, {
  get(_, prop, receiver) {
    const client = _db ?? (_db = createDb());
    const value = Reflect.get(client, prop, client);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
