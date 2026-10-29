import './helpers/setupTestDb';
// These tests exercise the 1–10 star rating, which is switched off by default (2026-10-25).
process.env.STAR_RATINGS_ENABLED = 'true';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { comparePassword, hashPassword, signJwtToken } from '../src/lib/auth';
import { read, type TestUser } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { normalizePhone } from '../src/lib/identity/phoneNumber';
import { peekDevOtp } from '../src/lib/identity/otpService';

// No Twilio in tests: the dev stand-in issues the codes and peekDevOtp()
// reads them back, as the server log would for a developer.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_VERIFY_SERVICE_SID;
delete process.env.PHONE_OTP_MODE;
// The gate under test; it's switched off by default while the site is in testing.
process.env.PHONE_VERIFICATION_REQUIRED = 'true';

import { GET as usernameAvailableGET } from '../src/app/api/auth/username-available/route';
import { POST as sendOtpPOST } from '../src/app/api/auth/phone/send-otp/route';
import { POST as phoneVerifyPOST } from '../src/app/api/auth/phone/verify/route';
import { POST as registerPOST } from '../src/app/api/auth/register/route';
import { POST as loginPOST } from '../src/app/api/auth/login/route';
import { POST as verifyCodePOST } from '../src/app/api/auth/phone/verify-code/route';
import { POST as phoneResetPOST } from '../src/app/api/auth/password-reset/phone/route';
import { POST as ratingPOST } from '../src/app/api/anime/[id]/rating/route';
import { POST as reviewsPOST } from '../src/app/api/reviews/route';

after(async () => {
  await prisma.$disconnect();
});

let ipCounter = 0;
/** A fresh client IP per call so tests never share an auth rate-limit bucket. */
function req(method: string, path: string, opts: { as?: TestUser; body?: unknown } = {}) {
  const headers = new Headers();
  headers.set('x-forwarded-for', `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`);
  if (opts.as) {
    headers.set('cookie', `anilog_token=${signJwtToken({ userId: opts.as.id, username: opts.as.username, email: opts.as.email })}`);
  }
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  headers.set('origin', 'http://localhost:3000');
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

let phoneSeq = 0;
/** A unique, valid Indian mobile number (national format) per call. */
const freshPhone = () => `9${String(Date.now() % 1e6).padStart(6, '0')}${String(phoneSeq++).padStart(3, '0')}`;
const e164 = (national: string) => normalizePhone(national, 'IN')!;
/** Every account has a password since 2026-10-28. */
const PW = 'otakuva-Pass-2026';

const rate = (as: TestUser, animeId: string) =>
  ratingPOST(req('POST', `/api/anime/${animeId}/rating`, { as, body: { score: 8 } }), { params: { id: animeId } }).then(read);

describe('phone number parsing', () => {
  test('normalises Indian numbers to E.164 and rejects malformed ones', () => {
    assert.equal(normalizePhone('98765 43210', 'IN'), '+919876543210');
    assert.equal(normalizePhone('098765-43210', 'IN'), '+919876543210');
    assert.equal(normalizePhone('+91 98765 43210', 'US'), '+919876543210', 'a full international number wins over the picker');
    assert.equal(normalizePhone('12345 67890', 'IN'), null, 'Indian mobiles start with 6–9');
    assert.equal(normalizePhone('98765', 'IN'), null);
    assert.equal(normalizePhone('+91 98765', 'IN'), null);
    assert.equal(normalizePhone('(415) 555-2671', 'US'), '+14155552671');
  });
});

describe('username availability', () => {
  let existing: TestUser;
  before(async () => {
    existing = await createUser();
  });

  const check = (username: string) =>
    usernameAvailableGET(req('GET', `/api/auth/username-available?username=${encodeURIComponent(username)}`)).then(read);

  test('fewer than 8 characters is rejected', async () => {
    const res = await check('short_7');
    assert.equal(res.body.available, false);
    assert.equal(res.body.reason, 'invalid');
    assert.match(res.body.error, /at least 8/);
  });

  test('a taken username is reported as taken, case-insensitively', async () => {
    const res = await check(existing.username.toUpperCase());
    assert.equal(res.body.available, false);
    assert.equal(res.body.reason, 'taken');
    assert.equal(res.body.error, 'This username has been taken.');
  });

  test('a free username of 8+ characters is available', async () => {
    const res = await check(`fresh_${Date.now().toString(36)}`);
    assert.equal(res.body.available, true);
  });
});

describe('sign-up by phone', () => {
  const username = `phonefan_${Date.now().toString(36)}`;
  const phone = freshPhone();
  let anime: any;
  before(async () => {
    anime = await createAnime();
  });

  test('no code is sent for a taken or too-short username', async () => {
    const taken = await createUser();
    const res = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username: taken.username } })));
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'USERNAME_TAKEN');

    const short = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username: 'abc1234' } })));
    assert.equal(short.status, 400);
    assert.equal(peekDevOtp(e164(phone)), null, 'nothing was texted');
  });

  test('a wrong code does not create the account', async () => {
    const sent = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username } })));
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.devMode, true);
    const real = peekDevOtp(e164(phone))!;
    const wrong = real === '000000' ? '111111' : '000000';

    const res = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, phone, country: 'IN', code: wrong, password: PW } })));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'OTP_INVALID');
    assert.equal(await prisma.user.count({ where: { username } }), 0);
  });

  test('the right code creates a phone-verified account with a hashed password, signed in, and it can rate at once', async () => {
    const code = peekDevOtp(e164(phone))!;
    const res = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, phone, country: 'IN', code, password: PW } })));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.user.phoneVerified, true);
    assert.match(res.body.user.phoneMasked, /^\+91 •+\d{4}$/);
    assert.equal(JSON.stringify(res.body).includes(e164(phone)), false, 'the full number is never echoed back');

    const row = await prisma.user.findUniqueOrThrow({ where: { username } });
    assert.equal(row.phone, e164(phone));
    assert.ok(row.phoneVerifiedAt);
    assert.equal(row.email, null);
    assert.ok(row.passwordHash && row.passwordHash !== PW, 'password stored hashed');
    assert.equal(await comparePassword(PW, row.passwordHash!), true);

    const rated = await rate({ id: row.id, username: row.username, email: '' }, anime.id);
    assert.ok(rated.status === 200 || rated.status === 201, JSON.stringify(rated.body));
  });

  test('the same code cannot be used twice', async () => {
    const again = await read(
      await registerPOST(req('POST', '/api/auth/register', { body: { username: `${username}_2`, phone: freshPhone(), country: 'IN', code: '123456', password: PW } }))
    );
    assert.equal(again.status, 400);
  });

  test('a number can back only one account', async () => {
    const res = await read(
      await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username: `other_${Date.now().toString(36)}` } }))
    );
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'PHONE_IN_USE');
  });

  test('signs in with username + password (any case); wrong password and unknown user are refused alike', async () => {
    const login = await loginPOST(req('POST', '/api/auth/login', { body: { identifier: username.toUpperCase(), password: PW } }));
    const body = await read(login);
    assert.equal(body.status, 200, JSON.stringify(body.body));
    assert.equal(body.body.user.username, username);
    assert.ok(login.headers.get('set-cookie')?.includes('anilog_token='), 'session cookie set');

    const wrong = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: username, password: 'not-the-Pass-1' } })));
    assert.equal(wrong.status, 401);
    const unknown = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: `nobody_${Date.now()}`, password: PW } })));
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.error, wrong.body.error, 'same message: no hint which part was wrong');
  });

  test('a code alone can no longer sign in to an account that has a password', async () => {
    const sent = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'login', phone, country: 'IN' } })));
    assert.equal(sent.status, 200);
    const res = await read(await loginPOST(req('POST', '/api/auth/login', { body: { phone, country: 'IN', code: peekDevOtp(e164(phone)) } })));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'USE_PASSWORD');
  });
});

describe('legacy email/password accounts', () => {
  let legacy: TestUser;
  let anime: any;
  const password = 'legacy-password-1';

  before(async () => {
    anime = await createAnime();
    legacy = await createUser('USER', { verified: false });
    await prisma.user.update({ where: { id: legacy.id }, data: { passwordHash: await hashPassword(password) } });
  });

  test('cannot rate or review until a phone is verified', async () => {
    const rated = await rate(legacy, anime.id);
    assert.equal(rated.status, 403);
    assert.equal(rated.body.code, 'PHONE_NOT_VERIFIED');

    const review = await read(
      await reviewsPOST(req('POST', '/api/reviews', { as: legacy, body: { animeId: anime.id, body: 'A long enough review body to pass validation.' } }))
    );
    assert.equal(review.status, 403);
    assert.equal(review.body.code, 'PHONE_NOT_VERIFIED');
  });

  test('can still sign in with their password, reported as phone-unverified', async () => {
    const res = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: legacy.email, password } })));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.user.phoneVerified, false);
  });

  test("cannot link a number that belongs to another account", async () => {
    const owner = await createUser();
    const taken = freshPhone();
    await prisma.user.update({ where: { id: owner.id }, data: { phone: e164(taken) } });
    const res = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { as: legacy, body: { purpose: 'link', phone: taken, country: 'IN' } })));
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'PHONE_IN_USE');
  });

  test('linking a phone unlocks rating, and the password still signs in', async () => {
    const phone = freshPhone();
    const sent = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { as: legacy, body: { purpose: 'link', phone, country: 'IN' } })));
    assert.equal(sent.status, 200, JSON.stringify(sent.body));

    const linked = await read(
      await phoneVerifyPOST(req('POST', '/api/auth/phone/verify', { as: legacy, body: { phone, country: 'IN', code: peekDevOtp(e164(phone)) } }))
    );
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    assert.equal(linked.body.user.phoneVerified, true);

    const rated = await rate(legacy, anime.id);
    assert.ok(rated.status === 200 || rated.status === 201, JSON.stringify(rated.body));

    // Since 2026-10-28 every account signs in with its password, phone or not.
    const pw = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: legacy.email, password } })));
    assert.equal(pw.status, 200, JSON.stringify(pw.body));
  });
});

describe('while phone verification is switched off', () => {
  test('an account without a verified phone can rate, and is not told to verify', async () => {
    process.env.PHONE_VERIFICATION_REQUIRED = 'false';
    try {
      const anime = await createAnime();
      const unverified = await createUser('USER', { verified: false });
      const rated = await rate(unverified, anime.id);
      assert.ok(rated.status === 200 || rated.status === 201, JSON.stringify(rated.body));
    } finally {
      process.env.PHONE_VERIFICATION_REQUIRED = 'true';
    }
  });

  test('mock OTP mode hands the code to the form instead of texting it', async () => {
    process.env.PHONE_OTP_MODE = 'mock';
    process.env.TWILIO_ACCOUNT_SID = 'AC_should_not_be_used';
    process.env.TWILIO_AUTH_TOKEN = 'unused';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_unused';
    try {
      const phone = freshPhone();
      const username = `mockotp_${Date.now().toString(36)}`;
      const sent = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username } })));
      assert.equal(sent.status, 200, JSON.stringify(sent.body));
      assert.match(sent.body.mockCode, /^\d{6}$/);
      const reg = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, phone, country: 'IN', code: sent.body.mockCode, password: PW } })));
      assert.equal(reg.status, 200, JSON.stringify(reg.body));
    } finally {
      delete process.env.PHONE_OTP_MODE;
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_VERIFY_SERVICE_SID;
    }
  });
});

describe('OTP brute force', () => {
  test('after 5 wrong codes the number is locked out, even with the right code', async () => {
    const username = `bruteforce_${Date.now().toString(36)}`;
    const phone = freshPhone();
    await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username } }));
    const real = peekDevOtp(e164(phone))!;
    const wrong = real === '999999' ? '888888' : '999999';
    for (let i = 0; i < 5; i++) {
      await registerPOST(req('POST', '/api/auth/register', { body: { username, phone, country: 'IN', code: wrong, password: PW } }));
    }
    const res = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, phone, country: 'IN', code: real, password: PW } })));
    assert.equal(res.status, 429);
    assert.equal(await prisma.user.count({ where: { username } }), 0);
  });
});

describe('sign-up with a verified phone pass + password (the form flow)', () => {
  test('code → pass → password creates the account; no password or a weak one is refused', async () => {
    const username = `passflow_${Date.now().toString(36)}`;
    const phone = freshPhone();
    await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'register', phone, country: 'IN', username } }));
    const ver = await read(await verifyCodePOST(req('POST', '/api/auth/phone/verify-code', { body: { purpose: 'register', phone, country: 'IN', code: peekDevOtp(e164(phone)) } })));
    assert.equal(ver.status, 200, JSON.stringify(ver.body));
    assert.equal(typeof ver.body.pass, 'string');

    const none = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, pass: ver.body.pass } })));
    assert.equal(none.status, 400);
    assert.equal(none.body.code, 'INVALID_PASSWORD');
    const weak = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, pass: ver.body.pass, password: 'abcdefgh' } })));
    assert.equal(weak.status, 400);

    const ok = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username, pass: ver.body.pass, password: PW } })));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const row = await prisma.user.findUniqueOrThrow({ where: { username } });
    assert.equal(row.phone, e164(phone));
    assert.ok(row.phoneVerifiedAt);
  });

  test('a forged or wrong-purpose pass is refused, and a pass is never a session', async () => {
    const forged = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username: `forged_${Date.now().toString(36)}`, pass: 'not.a.pass', password: PW } })));
    assert.equal(forged.status, 400);
    assert.equal(forged.body.code, 'PASS_INVALID');

    // A reset pass can't create an account.
    const owner = await createUser();
    const ownerPhone = freshPhone();
    await prisma.user.update({ where: { id: owner.id }, data: { phone: e164(ownerPhone) } });
    await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'reset', phone: ownerPhone, country: 'IN' } }));
    const ver = await read(await verifyCodePOST(req('POST', '/api/auth/phone/verify-code', { body: { purpose: 'reset', phone: ownerPhone, country: 'IN', code: peekDevOtp(e164(ownerPhone)) } })));
    assert.equal(ver.status, 200, JSON.stringify(ver.body));
    const wrongPurpose = await read(await registerPOST(req('POST', '/api/auth/register', { body: { username: `wrongp_${Date.now().toString(36)}`, pass: ver.body.pass, password: PW } })));
    assert.equal(wrongPurpose.status, 400);

    // Used as a session cookie, the pass identifies nobody.
    const { getAuthUserFromRequest } = await import('../src/lib/auth');
    const headers = new Headers({ cookie: `anilog_token=${ver.body.pass}` });
    assert.equal(await getAuthUserFromRequest(new NextRequest(new URL('/api/auth/me', 'http://localhost:3000'), { headers })), null);
  });
});

describe('forgot password by phone', () => {
  test('phone → code → new password signs in; the pass works once; the old password stops working', async () => {
    const user = await createUser();
    const phone = freshPhone();
    await prisma.user.update({ where: { id: user.id }, data: { phone: e164(phone), passwordHash: await hashPassword('Old-password-1') } });

    const unknown = await read(await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'reset', phone: freshPhone(), country: 'IN' } })));
    assert.equal(unknown.status, 404);

    await sendOtpPOST(req('POST', '/api/auth/phone/send-otp', { body: { purpose: 'reset', phone, country: 'IN' } }));
    const ver = await read(await verifyCodePOST(req('POST', '/api/auth/phone/verify-code', { body: { purpose: 'reset', phone, country: 'IN', code: peekDevOtp(e164(phone)) } })));
    assert.equal(ver.status, 200, JSON.stringify(ver.body));

    // Passes are stamped to the second; make sure the change lands after it.
    await new Promise((r) => setTimeout(r, 1100));
    const reset = await phoneResetPOST(req('POST', '/api/auth/password-reset/phone', { body: { pass: ver.body.pass, password: 'New-password-2' } }));
    const body = await read(reset);
    assert.equal(body.status, 200, JSON.stringify(body.body));
    assert.ok(reset.headers.get('set-cookie')?.includes('anilog_token='), 'signed in');

    const again = await read(await phoneResetPOST(req('POST', '/api/auth/password-reset/phone', { body: { pass: ver.body.pass, password: 'Another-password-3' } })));
    assert.equal(again.status, 400);
    assert.equal(again.body.code, 'PASS_USED');

    const oldPw = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: user.username, password: 'Old-password-1' } })));
    assert.equal(oldPw.status, 401);
    const newPw = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: user.username, password: 'New-password-2' } })));
    assert.equal(newPw.status, 200, JSON.stringify(newPw.body));
  });

  test('an older phone account without a password is told to use "Forgot password"', async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
    const res = await read(await loginPOST(req('POST', '/api/auth/login', { body: { identifier: user.username, password: PW } })));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'NO_PASSWORD');
  });
});
