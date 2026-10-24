import React from 'react';
import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 20px',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          backgroundColor: 'var(--surface-elevated, #202024)',
          border: '1px solid var(--border-default, #2A2A2E)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-primary-hover)',
          marginBottom: '8px',
        }}
      >
        <Compass size={28} />
      </div>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary, #EDEDEF)',
          letterSpacing: '-0.015em',
        }}
      >
        404 — Page Not Found
      </h1>

      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary, #9E9EA4)',
          maxWidth: '440px',
          lineHeight: 1.6,
        }}
      >
        The anime title, record, or page you are looking for does not exist in the OTAKUVA catalog or has moved.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '8px',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
            padding: '8px 18px',
            borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          <Home size={14} />
          <span>Back to Home</span>
        </Link>

        <Link
          href="/anime"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: 'var(--surface-elevated, #202024)',
            border: '1px solid var(--border-default, #2A2A2E)',
            color: 'var(--text-primary, #EDEDEF)',
            padding: '8px 16px',
            borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          <Compass size={14} />
          <span>Explore Catalog</span>
        </Link>
      </div>
    </div>
  );
}
