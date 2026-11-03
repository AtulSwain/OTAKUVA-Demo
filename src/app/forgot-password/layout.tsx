import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot password or username',
  robots: { index: false, follow: true },
};

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
