/**
 * OTAKUVA SECURITY — PHASE 10.1
 * XSS SANITIZATION & OUTPUT ENCODING ENGINE
 * 
 * Strict sanitization for user-generated content (UGC):
 * - Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>` tags
 * - Strips all inline event handlers (`onload`, `onerror`, `onclick`, `onmouseover`, etc.)
 * - Strips `javascript:`, `vbscript:`, `data:` pseudo-protocols from URLs
 * - Escapes raw HTML entities for plain text fields (usernames, titles)
 * - Safe Markdown rendering preservation for rich text (reviews, descriptions, discussions)
 */

export class XssSanitizer {
  /**
   * Escapes dangerous HTML characters into HTML entities for plain-text outputs
   */
  static escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitizes rich user text (Markdown / Discussion Body / Reviews)
   * Strips malicious executable HTML while preserving clean markdown structure
   */
  static sanitizeUgc(input: string): string {
    if (!input || typeof input !== 'string') return '';

    let clean = input;

    // 1. Remove dangerous executable HTML tags and contents
    clean = clean.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    clean = clean.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
    clean = clean.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');
    clean = clean.replace(/<\s*embed[^>]*>[\s\S]*?<\s*\/\s*embed\s*>/gi, '');
    clean = clean.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
    clean = clean.replace(/<\s*form[^>]*>[\s\S]*?<\s*\/\s*form\s*>/gi, '');
    clean = clean.replace(/<\s*base[^>]*>/gi, '');
    clean = clean.replace(/<\s*link[^>]*>/gi, '');
    clean = clean.replace(/<\s*meta[^>]*>/gi, '');

    // 2. Remove inline event handlers on any remaining HTML tags (e.g. onerror, onclick, onmouseover)
    clean = clean.replace(/\s*on[a-zA-Z]+\s*=\s*(['"]).*?\1/gi, '');
    clean = clean.replace(/\s*on[a-zA-Z]+\s*=\s*[^>\s]+/gi, '');

    // 3. Remove javascript: and data: pseudo-protocols from attributes
    clean = clean.replace(/(href|src|action)\s*=\s*(['"])\s*(javascript|vbscript|data):.*?\2/gi, '$1="#"');
    clean = clean.replace(/(href|src|action)\s*=\s*(javascript|vbscript|data):[^\s>]+/gi, '$1="#"');

    return clean.trim();
  }

  /**
   * Cleans a plain text user input (e.g. username, discussion title)
   * Disallows all HTML tags entirely
   */
  static sanitizePlainText(input: string): string {
    if (!input || typeof input !== 'string') return '';
    // Strip all HTML tags completely
    const stripped = input.replace(/<\/?[^>]+(>|$)/g, '');
    return this.escapeHtml(stripped.trim());
  }
}

export function sanitizeText(input: string): string {
  return XssSanitizer.sanitizePlainText(input);
}

export function escapeHtml(str: string): string {
  return XssSanitizer.escapeHtml(str);
}
