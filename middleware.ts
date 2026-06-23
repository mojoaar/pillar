import { authConfig } from '@/lib/auth.config';
import NextAuth from 'next-auth';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth');
  const isPublicApiRoute = nextUrl.pathname === '/api/health' || nextUrl.pathname === '/api/setup';
  const isAuthRoute = ['/login', '/setup'].includes(nextUrl.pathname);
  const isRootRoute = nextUrl.pathname === '/';

  // Allow API auth endpoints to pass without restriction
  if (isApiAuthRoute || isPublicApiRoute) {
    return;
  }

  // Handle root route redirection
  if (isRootRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL('/dashboard', nextUrl));
    }
    return; // Allow public landing on root page
  }

  // Redirect logged-in users away from auth pages to dashboard
  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL('/dashboard', nextUrl));
    }
    return;
  }

  // Guard protected pages
  if (!isLoggedIn) {
    // Redirect to login page, preserving the original destination url as a callback
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return Response.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // Admin routing guards (ADMIN role constraint)
  if (nextUrl.pathname.startsWith('/admin')) {
    const userRole = (req.auth?.user as any)?.role;
    if (userRole !== 'ADMIN') {
      // Reject non-admin users trying to access admin dashboards
      return Response.redirect(new URL('/dashboard', nextUrl));
    }
  }

  return;
});

export const config = {
  // Apply middleware to all protected routes, excluding static assets and next internal directories
  matcher: ['/((?!_next|[^?]*\\.(?:html|css|js|jpe?g|png|gif|svg|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
