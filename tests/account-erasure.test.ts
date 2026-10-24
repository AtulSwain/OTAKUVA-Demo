import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { request, read } from './helpers/http';
import { createAnime, createCommunity, createUser } from './helpers/fixtures';

import { DELETE as accountDELETE } from '../src/app/api/account/route';
import { GET as exportGET } from '../src/app/api/account/export/route';
import { POST as ratingPOST } from '../src/app/api/anime/[id]/rating/route';
import { POST as sendOtpPOST } from '../src/app/api/auth/phone/send-otp/route';
import { peekDevOtp } from '../src/lib/identity/otpService';

// No Twilio in tests: the dev stand-in issues codes and peekDevOtp() reads them.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_VERIFY_SERVICE_SID;
delete process.env.PHONE_OTP_MODE;

after(async () => {
  await prisma.$disconnect();
});

const PASSWORD = 'a-real-password-123';

let phoneSeq = 0;
/** A phone sign-up account: verified phone, no password. */
async function createPhoneUser() {
  const base = await createUser();
  const phone = `+9170${String(Date.now() % 1e6).padStart(6, '0')}${String(++phoneSeq).padStart(2, '0')}`;
  await prisma.user.update({ where: { id: base.id }, data: { phone, phoneVerifiedAt: new Date() } });
  return { ...base, phone };
}

async function createUserWithPassword(password = PASSWORD) {
  const base = await createUser();
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: base.id }, data: { passwordHash } });
  return base;
}

describe('DELETE /api/account (right to erasure)', () => {
  test('requires authentication', async () => {
    const res = await accountDELETE(request('DELETE', '/api/account'));
    assert.equal(res.status, 401);
  });

  test('requires the literal confirmation phrase', async () => {
    const user = await createUserWithPassword();
    const res = await accountDELETE(
      request('DELETE', '/api/account', { as: user, body: { password: PASSWORD, confirmation: 'delete' } })
    );
    assert.equal(res.status, 400);
    assert.ok(await prisma.user.findUnique({ where: { id: user.id } }), 'account must still exist');
  });

  test('rejects an incorrect password and leaves the account untouched', async () => {
    const user = await createUserWithPassword();
    const res = await accountDELETE(
      request('DELETE', '/api/account', { as: user, body: { password: 'wrong-password', confirmation: 'DELETE' } })
    );
    assert.equal(res.status, 401);
    assert.ok(await prisma.user.findUnique({ where: { id: user.id } }));
  });

  test('blocks deletion while the account owns a community, without touching it', async () => {
    const owner = await createUserWithPassword();
    const community = await createCommunity(owner, 'PUBLIC');

    const res = await accountDELETE(
      request('DELETE', '/api/account', { as: owner, body: { password: PASSWORD, confirmation: 'DELETE' } })
    );
    assert.equal(res.status, 409);
    const body = await read(res);
    assert.equal(body.body.ownedCommunities?.[0]?.slug, community.slug);

    assert.ok(await prisma.user.findUnique({ where: { id: owner.id } }), 'owner account untouched');
    assert.ok(await prisma.community.findUnique({ where: { id: community.id } }), 'community untouched');
  });

  test('deletes the account, cascades personal data, clears the session cookie, and leaves an anonymized audit trail', async () => {
    const user = await createUserWithPassword();
    const anime = await createAnime();
    await ratingPOST(request('POST', `/api/anime/${anime.id}/rating`, { as: user, body: { score: 8 } }), { params: { id: anime.id } });
    assert.equal(await prisma.animeRating.count({ where: { userId: user.id } }), 1, 'sanity check before deletion');

    const res = await accountDELETE(
      request('DELETE', '/api/account', { as: user, body: { password: PASSWORD, confirmation: 'DELETE' } })
    );
    assert.equal(res.status, 200);

    assert.equal(await prisma.user.findUnique({ where: { id: user.id } }), null, 'the user row itself is gone');
    assert.equal(await prisma.animeRating.count({ where: { userId: user.id } }), 0, 'cascaded personal data is gone');

    // Session cookie cleared — a stolen/replayed cookie for this account
    // can't keep working after the account no longer exists.
    const cookie = res.cookies.get('anilog_token');
    assert.ok(!cookie?.value, 'anilog_token cookie is cleared in the response');

    // The deletion itself is logged before the user row is removed
    // (src/app/api/account/route.ts), and AuditLog.actorId is the one
    // User relation that's onDelete: SetNull rather than Cascade — so the
    // record of "an account was deleted" survives, anonymized, once the
    // cascade fires.
    const auditRow = await prisma.auditLog.findFirst({ where: { action: 'ACCOUNT_DELETED', entityId: user.id } });
    assert.ok(auditRow, 'an anonymized audit record survives the deletion');
    assert.equal(auditRow?.actorId, null, 'actorId was nulled out by the cascade, not left dangling or deleted');
  });

  // Passwordless (phone sign-up) accounts used to be deletable with only the
  // session cookie and the word DELETE; they now confirm with a texted code.
  test('a phone sign-up account (no password) needs a code texted to its own number', async () => {
    const user = await createPhoneUser();

    const noCode = await read(await accountDELETE(request('DELETE', '/api/account', { as: user, body: { confirmation: 'DELETE' } })));
    assert.equal(noCode.status, 400);
    assert.equal(noCode.body.code, 'CODE_REQUIRED');

    const sent = await read(await sendOtpPOST(request('POST', '/api/auth/phone/send-otp', { as: user, body: { purpose: 'reauth' } })));
    assert.equal(sent.status, 200);
    assert.equal('phone' in sent.body, false, 'reauth never echoes the full number');
    const code = peekDevOtp(user.phone);
    assert.ok(code, 'a code was issued for the account’s own number');

    const wrong = await accountDELETE(request('DELETE', '/api/account', { as: user, body: { confirmation: 'DELETE', code: code === '000000' ? '111111' : '000000' } }));
    assert.equal(wrong.status, 401);
    assert.ok(await prisma.user.findUnique({ where: { id: user.id } }), 'a wrong code deletes nothing');

    // The wrong attempt may consume the dev code; request a fresh one.
    await sendOtpPOST(request('POST', '/api/auth/phone/send-otp', { as: user, body: { purpose: 'reauth' } }));
    const fresh = peekDevOtp(user.phone)!;
    const ok = await accountDELETE(request('DELETE', '/api/account', { as: user, body: { confirmation: 'DELETE', code: fresh } }));
    assert.equal(ok.status, 200);
    assert.equal(await prisma.user.findUnique({ where: { id: user.id } }), null);
  });

  test('reauth codes always go to the signed-in account’s own number, never one supplied by the client', async () => {
    const user = await createPhoneUser();
    const attackerPhone = '+919999900001';
    const res = await sendOtpPOST(request('POST', '/api/auth/phone/send-otp', { as: user, body: { purpose: 'reauth', phone: attackerPhone, country: 'IN' } }));
    assert.equal(res.status, 200);
    assert.ok(peekDevOtp(user.phone));
    assert.equal(peekDevOtp(attackerPhone), null);
  });

  test('reauth requires a signed-in account with a phone', async () => {
    assert.equal((await sendOtpPOST(request('POST', '/api/auth/phone/send-otp', { body: { purpose: 'reauth' } }))).status, 401);
    const noPhone = await createUser();
    assert.equal((await sendOtpPOST(request('POST', '/api/auth/phone/send-otp', { as: noPhone, body: { purpose: 'reauth' } }))).status, 400);
  });

  test('an account with neither a password nor a phone cannot be deleted without support', async () => {
    const user = await createUser(); // no passwordHash, no phone
    const res = await accountDELETE(request('DELETE', '/api/account', { as: user, body: { confirmation: 'DELETE' } }));
    assert.equal(res.status, 400);
    assert.ok(await prisma.user.findUnique({ where: { id: user.id } }));
  });
});

describe('GET /api/account/export (right to access)', () => {
  test('requires authentication', async () => {
    const res = await exportGET(request('GET', '/api/account/export'));
    assert.equal(res.status, 401);
  });

  test('returns the account’s own data, including related rows, and never the password hash', async () => {
    const user = await createUserWithPassword();
    const anime = await createAnime();
    await ratingPOST(request('POST', `/api/anime/${anime.id}/rating`, { as: user, body: { score: 6.5 } }), { params: { id: anime.id } });

    const res = await exportGET(request('GET', '/api/account/export', { as: user }));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') || '', /attachment/);

    const body = await res.json();
    assert.equal(body.data.id, user.id);
    assert.equal(body.data.username, user.username);
    assert.equal('passwordHash' in body.data, false, 'password hash is never included in the export');
    assert.equal(body.data.ratings.length, 1);
    assert.equal(body.data.ratings[0].rating, 6.5);
  });

  test('is rate-limited — a burst of requests past the account-export budget is rejected', async () => {
    const user = await createUserWithPassword();
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await exportGET(request('GET', '/api/account/export', { as: user }));
      results.push(res.status);
    }
    assert.ok(results.slice(0, 5).every((s) => s === 200), 'the first five requests succeed');
    assert.equal(results[5], 429, 'the sixth request within the window is rejected');
  });
});
