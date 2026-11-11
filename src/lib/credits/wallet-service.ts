import crypto from 'crypto';
import type { CreditLedgerEntry, CreditWallet } from '@/types/domain';

// =============================================================================
// MoneyMate — Atomic Credit System & Signed Anonymous Trial Engine (Section 4)
// Rules:
// - 1 successful non-duplicate image = 1 Credit
// - Failed jobs = 0 Credit deducted
// - Duplicate items = 0 Credit deducted
// - Idempotency key prevents double deduction on retry or duplicate request
// - Anonymous Trial uses HMAC-SHA256 signed token + IP fingerprint rate limit
// =============================================================================

export interface CreditDeductionResult {
  deducted: boolean;
  reason:
    | 'charged_one_credit'
    | 'duplicate_document_free'
    | 'failed_job_free'
    | 'already_deducted_for_job';
  wallet: CreditWallet;
  ledgerEntry: CreditLedgerEntry | null;
}

/**
 * Pure, atomic-style credit deduction processor used by both in-memory/test engine
 * and verified against the PostgreSQL RPC `deduct_credit_for_job`.
 */
export function executeAtomicJobCreditDeduction(params: {
  wallet: CreditWallet;
  ledger: CreditLedgerEntry[];
  jobId: string;
  documentId: string;
  jobStatus: 'completed' | 'failed';
  isDuplicate: boolean;
}): CreditDeductionResult {
  const { wallet, ledger, jobId, documentId, jobStatus, isDuplicate } = params;

  // 1. Failed jobs never deduct credits
  if (jobStatus === 'failed') {
    return {
      deducted: false,
      reason: 'failed_job_free',
      wallet,
      ledgerEntry: null,
    };
  }

  // 2. Duplicate documents never deduct credits
  if (isDuplicate) {
    return {
      deducted: false,
      reason: 'duplicate_document_free',
      wallet,
      ledgerEntry: null,
    };
  }

  // 3. Idempotency check: prevent double deduction for the same jobId (e.g., on Retry)
  const idempotencyKey = `job_deduct_${jobId}`;
  const existingEntry = ledger.find((e) => e.idempotency_key === idempotencyKey);
  if (existingEntry) {
    return {
      deducted: false,
      reason: 'already_deducted_for_job',
      wallet,
      ledgerEntry: existingEntry,
    };
  }

  // 4. Verify sufficient balance
  if (wallet.balance < 1) {
    throw new Error('INSUFFICIENT_CREDITS: เครดิตคงเหลือไม่เพียงพอสำหรับการประมวลผล');
  }

  const newBalance = wallet.balance - 1;
  const nowIso = new Date().toISOString();

  const updatedWallet: CreditWallet = {
    ...wallet,
    balance: newBalance,
    lifetime_used: wallet.lifetime_used + 1,
    updated_at: nowIso,
  };

  const newEntry: CreditLedgerEntry = {
    id: crypto.randomUUID(),
    user_id: wallet.user_id,
    delta: -1,
    balance_after: newBalance,
    entry_type: 'job_deduction',
    idempotency_key: idempotencyKey,
    reference_id: documentId,
    reason: 'หักเครดิตประมวลผลเอกสารสำเร็จ (1 รูป = 1 เครดิต)',
    created_by: null,
    created_at: nowIso,
  };

  wallet.balance = updatedWallet.balance;
  wallet.lifetime_used = updatedWallet.lifetime_used;
  wallet.updated_at = updatedWallet.updated_at;
  ledger.unshift(newEntry);

  return {
    deducted: true,
    reason: 'charged_one_credit',
    wallet: updatedWallet,
    ledgerEntry: newEntry,
  };
}

// =============================================================================
// Signed Anonymous Trial Session (5 Free Credits + Anti-Reset Rate Limit)
// =============================================================================

export interface AnonymousTrialPayload {
  sessionId: string;
  ipHash: string;
  creditsRemaining: number;
  issuedAt: number;
}

const ipTrialTracker = new Map<
  string,
  { sessionId: string; creditsRemaining: number; createdAt: number }
>();

function getTrialSecret(): string {
  return (
    process.env.TRIAL_SESSION_SECRET ||
    'moneymate-default-trial-hmac-secret-key-2026'
  );
}

export function hashClientIp(ip: string): string {
  return crypto
    .createHmac('sha256', getTrialSecret())
    .update(ip || '127.0.0.1')
    .digest('hex')
    .slice(0, 24);
}

export function signAnonymousTrialToken(payload: AnonymousTrialPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getTrialSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifyAnonymousTrialToken(
  token: string | undefined | null
): AnonymousTrialPayload | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getTrialSecret())
    .update(data)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as AnonymousTrialPayload;
  } catch {
    return null;
  }
}

/**
 * Issues or retrieves an anonymous 5-credit trial session bound to the client IP hash,
 * preventing users from clearing cookies to obtain unlimited free credits.
 */
export function getOrCreateAnonymousTrial(
  clientIp: string,
  existingCookieToken?: string | null
): { token: string; payload: AnonymousTrialPayload } {
  const ipHash = hashClientIp(clientIp);
  const tracked = ipTrialTracker.get(ipHash);

  const verified = verifyAnonymousTrialToken(existingCookieToken);
  if (verified && verified.ipHash === ipHash) {
    // Sync with server-side IP tracker so cookie replay cannot restore spent credits
    const effectiveCredits = tracked
      ? Math.min(verified.creditsRemaining, tracked.creditsRemaining)
      : verified.creditsRemaining;
    const synced: AnonymousTrialPayload = {
      ...verified,
      creditsRemaining: effectiveCredits,
    };
    ipTrialTracker.set(ipHash, {
      sessionId: synced.sessionId,
      creditsRemaining: effectiveCredits,
      createdAt: synced.issuedAt,
    });
    return { token: signAnonymousTrialToken(synced), payload: synced };
  }

  // If IP already claimed a trial session earlier, return its remaining balance instead of resetting to 5
  if (tracked) {
    const payload: AnonymousTrialPayload = {
      sessionId: tracked.sessionId,
      ipHash,
      creditsRemaining: tracked.creditsRemaining,
      issuedAt: tracked.createdAt,
    };
    return { token: signAnonymousTrialToken(payload), payload };
  }

  // First time for this IP: grant 5 free trial credits
  const freshPayload: AnonymousTrialPayload = {
    sessionId: crypto.randomUUID(),
    ipHash,
    creditsRemaining: 5,
    issuedAt: Date.now(),
  };
  ipTrialTracker.set(ipHash, {
    sessionId: freshPayload.sessionId,
    creditsRemaining: 5,
    createdAt: freshPayload.issuedAt,
  });

  return { token: signAnonymousTrialToken(freshPayload), payload: freshPayload };
}
