/**
 * OTAKUVA — one-time Twilio Verify setup for phone OTP sign-in.
 *
 * Usage (after putting TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env):
 *   npx tsx scripts/setup_twilio_verify.ts                        # check creds, create/reuse the Verify Service, write its SID to .env
 *   npx tsx scripts/setup_twilio_verify.ts --send-to=+919876543210  # …then text a test code to that number
 *   npx tsx scripts/setup_twilio_verify.ts --check=+919876543210:123456  # confirm the code you received
 *
 * Idempotent: reuses TWILIO_VERIFY_SERVICE_SID if it's valid, else an
 * existing service named "OTAKUVA", else creates one. Never prints the
 * auth token. Geo permissions and Fraud Guard are Console-only settings —
 * the script reminds you rather than pretending to set them.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const SERVICE_NAME = 'OTAKUVA';
const ENV_PATH = path.join(process.cwd(), '.env');

const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const auth = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

async function twilio(method: 'GET' | 'POST', url: string, params?: Record<string, string>) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: auth, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const body: any = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function writeEnvVar(name: string, value: string) {
  const line = `${name}="${value}"`;
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${name}=.*$`, 'm');
  const next = re.test(current) ? current.replace(re, line) : `${current.replace(/\n?$/, '\n')}${line}\n`;
  fs.writeFileSync(ENV_PATH, next);
}

async function resolveService(): Promise<string> {
  const existing = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (existing) {
    const r = await twilio('GET', `https://verify.twilio.com/v2/Services/${existing}`);
    if (r.status === 200) {
      console.log(`  ✓ Using existing Verify Service ${existing} ("${r.body.friendly_name}")`);
      return existing;
    }
    console.log(`  ! TWILIO_VERIFY_SERVICE_SID=${existing} not found on this account — finding/creating another.`);
  }

  const list = await twilio('GET', 'https://verify.twilio.com/v2/Services?PageSize=50');
  const match = (list.body.services || []).find((s: any) => s.friendly_name === SERVICE_NAME);
  if (match) {
    console.log(`  ✓ Found Verify Service "${SERVICE_NAME}" (${match.sid})`);
    return match.sid;
  }

  const created = await twilio('POST', 'https://verify.twilio.com/v2/Services', { FriendlyName: SERVICE_NAME, CodeLength: '6' });
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(`Creating the Verify Service failed (HTTP ${created.status}): ${created.body.message || 'unknown error'}`);
  }
  console.log(`  ✓ Created Verify Service "${SERVICE_NAME}" (${created.body.sid})`);
  return created.body.sid;
}

async function main() {
  console.log('Twilio Verify setup:');
  if (!accountSid || !authToken) {
    console.log('  ✗ TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN missing from .env.');
    console.log('    Copy both from https://console.twilio.com (Account Info panel) into .env, then rerun.');
    process.exitCode = 1;
    return;
  }
  if (!/^AC[0-9a-f]{32}$/i.test(accountSid)) {
    console.log('  ✗ TWILIO_ACCOUNT_SID should look like AC followed by 32 hex characters.');
    process.exitCode = 1;
    return;
  }

  const account = await twilio('GET', `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`);
  if (account.status !== 200) {
    console.log(`  ✗ Twilio rejected these credentials (HTTP ${account.status}). Re-copy the Auth Token from the Console.`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ Credentials valid — account "${account.body.friendly_name}" (${account.body.type}, ${account.body.status})`);
  const isTrial = account.body.type === 'Trial';

  const serviceSid = await resolveService();
  if (process.env.TWILIO_VERIFY_SERVICE_SID?.trim() !== serviceSid) {
    writeEnvVar('TWILIO_VERIFY_SERVICE_SID', serviceSid);
    console.log('  ✓ Wrote TWILIO_VERIFY_SERVICE_SID to .env — restart `npm run dev` to pick it up.');
  }

  const sendTo = process.argv.find((a) => a.startsWith('--send-to='))?.split('=')[1];
  const check = process.argv.find((a) => a.startsWith('--check='))?.split('=')[1];

  if (sendTo) {
    const r = await twilio('POST', `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, { To: sendTo, Channel: 'sms' });
    if (r.status === 201 || r.status === 200) {
      console.log(`\n  ✓ Code sent to ${sendTo} (status: ${r.body.status}). Confirm with --check=${sendTo}:<code>`);
    } else {
      console.log(`\n  ✗ Send failed (HTTP ${r.status}, Twilio error ${r.body.code}): ${r.body.message}`);
      if (r.body.code === 21608 || /unverified/i.test(String(r.body.message))) {
        console.log('    Trial accounts can only text numbers verified at Console → Phone Numbers → Verified Caller IDs.');
      }
      if (r.body.code === 60410 || r.body.code === 60605) {
        console.log('    Enable this country at Console → Verify → Settings → Geo Permissions.');
      }
      process.exitCode = 1;
    }
  }

  if (check) {
    const [to, code] = check.split(':');
    const r = await twilio('POST', `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, { To: to, Code: code });
    console.log(r.body.status === 'approved' ? `\n  ✓ Code approved — OTP delivery works end to end.` : `\n  ✗ Not approved (HTTP ${r.status}, status: ${r.body.status ?? r.body.message}).`);
  }

  console.log('\nStill to do in the Twilio Console (not settable from here):');
  console.log('  • Verify → Settings → Geo Permissions: allow only the countries you serve (India at minimum).');
  console.log('  • Verify → Fraud Guard: keep it enabled (default) to block SMS-pumping fraud.');
  if (isTrial) {
    console.log('  • Trial account: only Verified Caller IDs receive codes, and messages carry a trial prefix.');
    console.log('    Upgrade (Console → Billing) before real users sign up.');
  }
}

main().catch((err) => {
  console.error(`\n  ✗ ${err?.message || err}`);
  process.exitCode = 1;
});
