'use client';

/**
 * Root-level error boundary — only fires for an error thrown inside the
 * root layout itself (rare; a normal page/segment error is caught by
 * Next.js's default handling, or a route-level error.tsx if one exists).
 * Sentry specifically asks for this file (see its build-time warning) to
 * capture that class of error, since it happens above where the rest of
 * the app's own error handling can reach. Must render its own <html>/
 * <body> — it replaces the root layout when active, not just its children.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: '40px 20px',
          gap: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#141416',
          color: '#EDEDEF',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ fontSize: '14px', color: '#A1A1AA', maxWidth: '440px' }}>
          OTAKUVA hit an unexpected error. It&apos;s been reported — try again, or head back to the homepage.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#5B63FF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: '8px 16px',
              backgroundColor: '#27272B',
              color: '#EDEDEF',
              border: '1px solid #2A2A2E',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
