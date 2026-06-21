'use client';

import { useEffect } from 'react';

/**
 * Gotcha #34: Client-side event hook to intercept and suppress noisy browser 
 * extension errors (e.g. from Chrome or Firefox extensions) in development, 
 * preventing them from interrupting the Turbopack / Next.js dev error overlay.
 */
export default function ClientSuppression() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handler = (e: ErrorEvent) => {
      if (
        e.filename?.includes('extension://') ||
        e.message?.includes('Extension') ||
        e.error?.stack?.includes('extension://')
      ) {
        e.stopImmediatePropagation();
      }
    };

    const rejectionHandler = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (
        reason?.stack?.includes('extension://') ||
        reason?.message?.includes('Extension')
      ) {
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('error', handler, true);
    window.addEventListener('unhandledrejection', rejectionHandler, true);

    return () => {
      window.removeEventListener('error', handler, true);
      window.removeEventListener('unhandledrejection', rejectionHandler, true);
    };
  }, []);

  return null;
}
