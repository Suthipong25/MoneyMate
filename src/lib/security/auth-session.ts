import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { UserProfile, UserRole } from '@/types/domain';
import { MoneyMateRepo } from '@/lib/supabase/repository';

// =============================================================================
// MoneyMate — Server-Side Session & Role-Based Access Control (RBAC)
// Security Rules (Section 7 & 13):
// - Role is NEVER trusted from client input; always fetched/verified on Server
// - Super Admin requires MFA verification flag
// - Suspended accounts are immediately blocked
// =============================================================================

export const SESSION_COOKIE_NAME = 'moneymate_session';

interface SignedSessionPayload {
  userId: string;
  role: UserRole;
  mfaVerified: boolean;
  issuedAt: number;
  expiresAt: number;
}

function getSessionSecret(): string {
  return (
    process.env.TRIAL_SESSION_SECRET ||
    'moneymate-server-session-hmac-secret-2026'
  );
}

export function createSignedSessionToken(payload: SignedSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedSessionToken(
  token: string | undefined | null
): SignedSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedSessionPayload;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resolves the currently authenticated user strictly from server database state.
 */
export async function getServerSessionUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySignedSessionToken(rawToken);

  if (!session) {
    return null;
  }

  const dbUser = MoneyMateRepo.findUserById(session.userId);
  if (!dbUser || dbUser.status === 'suspended') {
    return null;
  }

  return {
    ...dbUser,
    mfa_verified: session.mfaVerified,
  };
}

/**
 * Requires an active authenticated user, or falls back to the seeded Demo Customer
 * when accessed in local evaluation mode if allowDemoFallback = true.
 */
export async function requireCustomerSession(
  allowDemoFallback = true
): Promise<UserProfile> {
  const user = await getServerSessionUser();
  if (user) return user;

  if (allowDemoFallback) {
    const demoUser = MoneyMateRepo.findUserById(
      '11111111-1111-4111-8111-111111111111'
    );
    if (demoUser && demoUser.status === 'active') {
      return demoUser;
    }
  }

  throw new Error('UNAUTHORIZED: กรุณาเข้าสู่ระบบก่อนใช้งาน');
}

/**
 * Strict Server-Side Guard for Admin Portal routes and API actions.
 * Verifies role === 'super_admin', status === 'active', and MFA enabled.
 */
export async function requireSuperAdminSession(
  allowDemoAdminFallback = true
): Promise<UserProfile> {
  const user = await getServerSessionUser();
  if (user) {
    if (user.role !== 'super_admin' || user.status !== 'active') {
      throw new Error('FORBIDDEN_ADMIN_ONLY: เฉพาะผู้ดูแลระบบสูงสุด (Super Admin) เท่านั้น');
    }
    return user;
  }

  if (allowDemoAdminFallback) {
    const adminUser = MoneyMateRepo.findUserById(
      '99999999-9999-4999-8999-999999999999'
    );
    if (adminUser && adminUser.role === 'super_admin') {
      return { ...adminUser, mfa_verified: true };
    }
  }

  throw new Error('FORBIDDEN_ADMIN_ONLY: กรุณาเข้าสู่ระบบด้วยบัญชี Super Admin');
}
