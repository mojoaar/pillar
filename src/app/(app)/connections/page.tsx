import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import ConnectionsCatalog from './ConnectionsCatalog';

export default async function ConnectionsCatalogPage() {
  // 1. Resolve session on the server
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  // 2. Fetch connections (owned + shared with current user)
  const connections = await db.connection.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { sharedWith: { some: { userId: session.user.id } } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  // 3. Fetch registered users (excluding current active user) for Sharing selection box
  const users = await db.user.findMany({
    where: {
      id: { not: session.user.id },
      isSuspended: false
    },
    select: {
      id: true,
      name: true,
      email: true
    },
    orderBy: { name: 'asc' }
  });

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email
  }));

  // Normalize models for catalog passing
  const serializedConnections = connections.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    username: c.username,
    authType: c.authType as 'PASSWORD' | 'KEY',
    isShared: c.isShared,
    userId: c.userId
  }));

  return (
    <ConnectionsCatalog
      initialConnections={serializedConnections}
      users={serializedUsers}
      currentUserId={session.user.id!}
    />
  );
}
