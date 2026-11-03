'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AccountRecoveryFlow } from '../../components/auth/AuthForm';
import { PageHead } from '../../components/ui/PageHead';
import styles from './forgot.module.css';

/**
 * Forgot password or username (2026-11-03, owner): the same flow as the
 * sign-in form's "Forgot password or username?" link, on its own page so
 * Support and emails can link to it.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  return (
    <div className={styles.page}>
      <PageHead kicker="Account help" title="Forgot password or username" />
      <div className={styles.card}>
        <AccountRecoveryFlow autoFocus onDone={() => router.push('/')} onNoAccount={() => router.push('/welcome')} />
      </div>
      <p className={styles.note}>
        No longer have the mobile number on your account? <Link href="/support">Contact support</Link>.
      </p>
    </div>
  );
}
