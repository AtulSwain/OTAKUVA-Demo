/**
 * OTAKUVA — check outbound email (Resend) configuration.
 *
 * Usage:
 *   npx tsx scripts/check_email.ts                       # validate .env only, sends nothing
 *   npx tsx scripts/check_email.ts --send-to=you@x.com   # also send one test email
 *
 * Never prints the API key. With Resend's test sender
 * (onboarding@resend.dev) mail is only delivered to the address that owns
 * the Resend account; verify a domain in Resend to email anyone.
 */
import 'dotenv/config';
import { checkEmailConfig, sendEmail } from '../src/lib/email/emailSender';

async function main() {
  const check = checkEmailConfig();
  const from = process.env.EMAIL_FROM?.trim();
  console.log('Email configuration:');
  console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY?.trim() ? 'set' : 'missing'}`);
  console.log(`  EMAIL_FROM:     ${from ? JSON.stringify(from) : 'missing'}`);
  if (!check.ok) {
    console.log('\nProblems (nothing will be emailed until these are fixed):');
    for (const p of check.problems) console.log(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n  ✓ Settings look valid.');

  const to = process.argv.find((a) => a.startsWith('--send-to='))?.split('=')[1];
  if (!to) {
    console.log('\nRun again with --send-to=your@email to send a real test email.');
    return;
  }
  const email = {
    subject: 'OTAKUVA email delivery check',
    text: 'If you can read this, OTAKUVA can send email (used for legacy-account password resets).',
  };
  try {
    await sendEmail({ to, ...email, subject: `[Test] ${email.subject}` });
    console.log(`\n  ✓ Resend accepted a test email to ${to}. Check that inbox (and spam).`);
  } catch (err: any) {
    console.log(`\n  ✗ Resend refused the email: ${err?.message}`);
    if (/onboarding@resend\.dev|testing emails|own email/i.test(String(err?.message))) {
      console.log('    With onboarding@resend.dev you can only send to your Resend account email. Verify a domain to send to anyone.');
    }
    process.exitCode = 1;
  }
}

main();
