/**
 * Switches for the phone-identity rollout. Server-only (reads env per call,
 * so tests and a restart pick up changes).
 *
 * PHONE_VERIFICATION_REQUIRED (default "false" while testing)
 *   "true"  → rating, reviewing and posting require a verified phone
 *             (requireVerifiedUser), and accounts without one are prompted.
 *   other   → any signed-in account can rate/review/post; no prompts.
 *   Turn on before launch — it's what stops one person running many
 *   accounts to move ratings.
 *
 * PHONE_OTP_MODE
 *   "mock"   → no SMS: the code is generated locally and shown in the
 *              sign-in form. Development only — ignored when
 *              NODE_ENV=production, where it would let anyone sign in to
 *              any number.
 *   other    → Twilio Verify when TWILIO_* is set (otherwise, outside
 *              production, the code goes to the server log).
 */

export function isPhoneVerificationRequired(): boolean {
  return process.env.PHONE_VERIFICATION_REQUIRED?.trim().toLowerCase() === 'true';
}

export function isMockOtpMode(): boolean {
  return process.env.PHONE_OTP_MODE?.trim().toLowerCase() === 'mock' && process.env.NODE_ENV !== 'production';
}
