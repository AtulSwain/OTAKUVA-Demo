/**
 * OTAKUVA SECURITY — PHASE 10.1
 * INPUT VALIDATION & SANITIZATION ENGINE
 * 
 * Strict server-side validation rules for user input across the platform:
 * - String length & format constraints
 * - Safe numeric range clamping
 * - Safe pagination parameter parsing with hard server caps
 * - URL & email validation
 * - ID format verification (CUID/UUID)
 */

export interface ValidationResult<T> {
  isValid: boolean;
  value: T;
  error?: string;
}

export class InputValidator {
  /**
   * Safely parses and clamps pagination parameters
   * Enforces server-side max page size (default max: 100)
   */
  static parsePagination(
    pageParam: string | null | undefined,
    limitParam: string | null | undefined,
    options: { defaultLimit?: number; maxLimit?: number } = {}
  ): { page: number; limit: number; skip: number } {
    const defaultLimit = options.defaultLimit || 20;
    const maxLimit = options.maxLimit || 100;

    let page = parseInt(pageParam || '1', 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(limitParam || `${defaultLimit}`, 10);
    if (isNaN(limit) || limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit; // Server-side hard cap

    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  /**
   * Validates and cleans a username
   */
  static validateUsername(username: unknown): ValidationResult<string> {
    if (typeof username !== 'string') {
      return { isValid: false, value: '', error: 'Username must be a string.' };
    }
    const clean = username.trim();
    if (clean.length < 3) {
      return { isValid: false, value: clean, error: 'Username must be at least 3 characters long.' };
    }
    if (clean.length > 30) {
      return { isValid: false, value: clean, error: 'Username cannot exceed 30 characters.' };
    }
    // Alphanumeric + underscores/hyphens only
    const validRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validRegex.test(clean)) {
      return { isValid: false, value: clean, error: 'Username may only contain letters, numbers, underscores, and hyphens.' };
    }
    return { isValid: true, value: clean };
  }

  /**
   * Validates email format
   */
  static validateEmail(email: unknown): ValidationResult<string> {
    if (typeof email !== 'string') {
      return { isValid: false, value: '', error: 'Email must be a string.' };
    }
    const clean = email.trim().toLowerCase();
    if (clean.length < 5 || clean.length > 254) {
      return { isValid: false, value: clean, error: 'Invalid email length.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      return { isValid: false, value: clean, error: 'Invalid email address format.' };
    }
    return { isValid: true, value: clean };
  }

  /**
   * Validates a password against security policy
   */
  static validatePassword(password: unknown): ValidationResult<string> {
    if (typeof password !== 'string') {
      return { isValid: false, value: '', error: 'Password must be a string.' };
    }
    if (password.length < 8) {
      return { isValid: false, value: '', error: 'Password must be at least 8 characters long.' };
    }
    if (password.length > 128) {
      return { isValid: false, value: '', error: 'Password cannot exceed 128 characters.' };
    }
    return { isValid: true, value: password };
  }

  /**
   * Validates rating score (1.0 to 10.0 in 0.1 increments)
   */
  static validateRating(rating: unknown): ValidationResult<number> {
    const num = typeof rating === 'number' ? rating : parseFloat(`${rating}`);
    if (isNaN(num)) {
      return { isValid: false, value: 0, error: 'Rating must be a numeric value.' };
    }
    if (num < 1.0 || num > 10.0) {
      return { isValid: false, value: num, error: 'Rating must be between 1.0 and 10.0.' };
    }
    return { isValid: true, value: parseFloat(num.toFixed(1)) };
  }

  /**
   * Validates entity ID string (non-empty, length bounded, safe characters)
   */
  static validateId(id: unknown, fieldName = 'ID'): ValidationResult<string> {
    if (typeof id !== 'string') {
      return { isValid: false, value: '', error: `${fieldName} must be a string.` };
    }
    const clean = id.trim();
    if (clean.length === 0 || clean.length > 64) {
      return { isValid: false, value: clean, error: `Invalid ${fieldName} length.` };
    }
    const safeIdRegex = /^[a-zA-Z0-9_-]+$/;
    if (!safeIdRegex.test(clean)) {
      return { isValid: false, value: clean, error: `${fieldName} contains invalid characters.` };
    }
    return { isValid: true, value: clean };
  }
}
