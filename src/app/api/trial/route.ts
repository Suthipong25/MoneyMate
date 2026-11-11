import { NextResponse, type NextRequest } from 'next/server';
import {
  getOrCreateAnonymousTrial,
  signAnonymousTrialToken,
} from '@/lib/credits/wallet-service';
import { checkRateLimit } from '@/lib/security/rate-limit';

const TRIAL_COOKIE_NAME = 'moneymate_trial_session';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const existingCookie = request.cookies.get(TRIAL_COOKIE_NAME)?.value;
  const { token, payload } = getOrCreateAnonymousTrial(ip, existingCookie);

  const res = NextResponse.json({
    ok: true,
    sessionId: payload.sessionId,
    creditsRemaining: payload.creditsRemaining,
  });

  res.cookies.set(TRIAL_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rl = checkRateLimit({
    key: `trial_scan_${ip}`,
    limit: 15,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'ทดลองใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' },
      { status: 429 }
    );
  }

  const existingCookie = request.cookies.get(TRIAL_COOKIE_NAME)?.value;
  const { payload } = getOrCreateAnonymousTrial(ip, existingCookie);

  if (payload.creditsRemaining <= 0) {
    return NextResponse.json(
      {
        error:
          'คุณใช้สิทธิ์ทดลองสแกนฟรีครบ 5 รูปแล้ว กรุณาสมัครสมาชิกหรือเติมเครดิตเพื่อใช้งานต่อ',
        creditsRemaining: 0,
      },
      { status: 402 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const isDuplicate = Boolean(body.isDuplicate);

  // Duplicate slips never consume trial credits
  const nextCredits = isDuplicate
    ? payload.creditsRemaining
    : Math.max(0, payload.creditsRemaining - 1);

  const updatedPayload = {
    ...payload,
    creditsRemaining: nextCredits,
  };
  const updatedToken = signAnonymousTrialToken(updatedPayload);

  // Sync in-memory IP tracker by calling getOrCreateAnonymousTrial with the new signed token
  getOrCreateAnonymousTrial(ip, updatedToken);

  const res = NextResponse.json({
    ok: true,
    deducted: !isDuplicate,
    creditsRemaining: nextCredits,
  });

  res.cookies.set(TRIAL_COOKIE_NAME, updatedToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return res;
}
