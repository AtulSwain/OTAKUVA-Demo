import { after, test } from 'node:test';
import assert from 'node:assert/strict';

// Configure Resend before the sender module is first used (it caches its choice).
process.env.RESEND_API_KEY = 're_test_key';
process.env.EMAIL_FROM = 'OTAKUVA <no-reply@example.test>';

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

test('with RESEND_API_KEY + EMAIL_FROM set, emails go to the Resend API (never actually sent here)', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  }) as typeof fetch;

  const { sendEmail, isEmailDeliveryConfigured } = await import('../src/lib/email/emailSender');
  assert.equal(isEmailDeliveryConfigured(), true);

  await sendEmail({ to: 'new.user@example.test', subject: 'Verify', text: 'link', html: '<a href="x">Verify</a>' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer re_test_key');
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.to, ['new.user@example.test']);
  assert.equal(body.from, 'OTAKUVA <no-reply@example.test>');
  assert.equal(body.subject, 'Verify');
  assert.equal(body.html, '<a href="x">Verify</a>');
});

test('a Resend rejection throws (so callers log it) and never echoes the API key', async () => {
  globalThis.fetch = (async () => new Response('{"message":"domain not verified"}', { status: 403 })) as unknown as typeof fetch;
  const { sendEmail } = await import('../src/lib/email/emailSender');
  await assert.rejects(
    sendEmail({ to: 'a@example.test', subject: 's', text: 't' }),
    (err: Error) => /403/.test(err.message) && /domain not verified/.test(err.message) && !err.message.includes('re_test_key')
  );
});

test('a non-Resend key or a non-address EMAIL_FROM is reported, and nothing is sent', async () => {
  const { checkEmailConfig, isEmailDeliveryConfigured, sendEmail } = await import('../src/lib/email/emailSender');
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  let called = 0;
  globalThis.fetch = (async () => {
    called++;
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  try {
    process.env.RESEND_API_KEY = 'AIzaSyNotAResendKey';
    process.env.EMAIL_FROM = "OTAKUVA TEAM'S";
    const check = checkEmailConfig();
    assert.equal(check.ok, false);
    assert.ok(check.problems.some((p) => /start with "re_"/.test(p)));
    assert.ok(check.problems.some((p) => /EMAIL_FROM must be an email address/.test(p)));
    assert.ok(!check.problems.join(' ').includes('AIzaSyNotAResendKey'), 'the key itself is never echoed');
    assert.equal(isEmailDeliveryConfigured(), false);

    await sendEmail({ to: 'a@example.test', subject: 's', text: 't' }); // falls back to logging
    assert.equal(called, 0, 'nothing is sent to Resend with a bad config');
  } finally {
    process.env.RESEND_API_KEY = saved.key;
    process.env.EMAIL_FROM = saved.from;
  }
});
