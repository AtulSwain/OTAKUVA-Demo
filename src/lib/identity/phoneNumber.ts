/**
 * Phone number parsing — shared by the sign-in/sign-up form and the server.
 * Client-safe: no server imports. Numbers are stored and sent to the SMS
 * provider in E.164 ("+919876543210"). Validation here is structural only;
 * the SMS provider is the final word on whether a number is real.
 */

export interface CountryDialCode {
  iso: string;
  name: string;
  dialCode: string;
  /** National significant number length(s), when known; otherwise E.164's 4–14 applies. */
  nationalLengths?: number[];
}

// India first: it is the default selection in the form.
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso: 'IN', name: 'India', dialCode: '91', nationalLengths: [10] },
  { iso: 'US', name: 'United States', dialCode: '1', nationalLengths: [10] },
  { iso: 'CA', name: 'Canada', dialCode: '1', nationalLengths: [10] },
  { iso: 'GB', name: 'United Kingdom', dialCode: '44', nationalLengths: [10] },
  { iso: 'AU', name: 'Australia', dialCode: '61', nationalLengths: [9] },
  { iso: 'JP', name: 'Japan', dialCode: '81', nationalLengths: [9, 10] },
  { iso: 'BD', name: 'Bangladesh', dialCode: '880', nationalLengths: [10] },
  { iso: 'NP', name: 'Nepal', dialCode: '977', nationalLengths: [10] },
  { iso: 'LK', name: 'Sri Lanka', dialCode: '94', nationalLengths: [9] },
  { iso: 'PK', name: 'Pakistan', dialCode: '92', nationalLengths: [10] },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '971', nationalLengths: [9] },
  { iso: 'SA', name: 'Saudi Arabia', dialCode: '966', nationalLengths: [9] },
  { iso: 'SG', name: 'Singapore', dialCode: '65', nationalLengths: [8] },
  { iso: 'MY', name: 'Malaysia', dialCode: '60', nationalLengths: [9, 10] },
  { iso: 'ID', name: 'Indonesia', dialCode: '62' },
  { iso: 'PH', name: 'Philippines', dialCode: '63', nationalLengths: [10] },
  { iso: 'KR', name: 'South Korea', dialCode: '82', nationalLengths: [9, 10] },
  { iso: 'DE', name: 'Germany', dialCode: '49' },
  { iso: 'FR', name: 'France', dialCode: '33', nationalLengths: [9] },
  { iso: 'BR', name: 'Brazil', dialCode: '55', nationalLengths: [10, 11] },
  { iso: 'MX', name: 'Mexico', dialCode: '52', nationalLengths: [10] },
];

export const DEFAULT_COUNTRY_ISO = 'IN';

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Normalises user input to E.164, or returns null if it can't be a valid
 * number. Accepts a full international number ("+91 98765 43210") in
 * `input`, or a national number plus the selected country's ISO code.
 */
export function normalizePhone(input: string, countryIso: string = DEFAULT_COUNTRY_ISO): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const digits = trimmed.replace(/^00/, '').replace(/\D/g, '');
    const e164 = `+${digits}`;
    if (!E164.test(e164)) return null;
    // A known country code with a known length must match it exactly.
    const country = [...COUNTRY_DIAL_CODES]
      .sort((a, b) => b.dialCode.length - a.dialCode.length)
      .find((c) => digits.startsWith(c.dialCode));
    if (country?.nationalLengths && !country.nationalLengths.includes(digits.length - country.dialCode.length)) return null;
    if (country?.iso === 'IN' && !/^[6-9]/.test(digits.slice(2))) return null;
    return e164;
  }

  const country = COUNTRY_DIAL_CODES.find((c) => c.iso === countryIso);
  if (!country) return null;
  // Drop a leading trunk "0" ("098765 43210" in India, "07700 900123" in the UK).
  const national = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (country.nationalLengths && !country.nationalLengths.includes(national.length)) return null;
  // Indian mobile numbers start with 6–9.
  if (country.iso === 'IN' && !/^[6-9]/.test(national)) return null;
  const e164 = `+${country.dialCode}${national}`;
  return E164.test(e164) ? e164 : null;
}

/** "+919876543210" → "+91 ••••••3210". For showing a user their own number back without echoing it in full. */
export function maskPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  const country = [...COUNTRY_DIAL_CODES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => digits.startsWith(c.dialCode));
  const cc = country ? country.dialCode : digits.slice(0, Math.max(1, digits.length - 10));
  const rest = digits.slice(cc.length);
  return `+${cc} ${'•'.repeat(Math.max(0, rest.length - 4))}${rest.slice(-4)}`;
}
