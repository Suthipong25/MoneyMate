import crypto from 'crypto';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric value in Thai Baht (฿) with 2 decimal places.
 */
export function formatTHB(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '฿0.00';
  }
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO) in Thai Buddhist Era or standard Thai locale
 * using Asia/Bangkok timezone.
 */
export function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const parsed = dateStr.length === 10 ? new Date(`${dateStr}T00:00:00+07:00`) : new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  } catch {
    return dateStr;
  }
}

/**
 * Formats current or given timestamp in Asia/Bangkok as YYYY-MM-DD
 */
export function getBangkokISODate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Computes SHA-256 hex digest of a binary Buffer or string.
 */
export function computeSHA256(input: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Normalizes Thai/English names for comparison (removes titles, extra spaces, punctuation).
 */
export function normalizeAccountName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|บจก\.|หจก\.|บริษัท|ร้าน|mr\.|mrs\.|ms\.|miss)\s*/gi, '')
    .replace(/\s+(จำกัด|มหาชน|co\.,?\s*ltd\.?|inc\.?)$/gi, '')
    .replace(/[^a-z0-9ก-๙]/gi, '')
    .trim();
}

/**
 * Extracts trailing digits from a masked or full bank account number (e.g., "xxx-x-xx123-4" -> "1234")
 */
export function extractAccountDigits(accountStr: string | null | undefined): string {
  if (!accountStr) return '';
  return accountStr.replace(/\D/g, '');
}
