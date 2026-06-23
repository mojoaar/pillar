import { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [], // Empty providers block — populated in auth.ts for server-side processing
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'USER';
        token.username = (user as any).username;
        token.mfaEnabled = (user as any).mfaEnabled || false;
        token.tokenVersion = (user as any).tokenVersion || 0;
      }
      
      if (trigger === 'update' && session) {
        return { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).username = token.username as string;
        (session.user as any).mfaEnabled = token.mfaEnabled as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    newUser: '/setup',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 1 day session
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};
export default authConfig;
