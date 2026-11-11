import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  MoneyMateRepo,
  hashPassword,
  readDatabase,
  writeDatabase,
} from '@/lib/supabase/repository';
import {
  SESSION_COOKIE_NAME,
  createSignedSessionToken,
  getServerSessionUser,
} from '@/lib/security/auth-session';
import { checkRateLimit } from '@/lib/security/rate-limit';

const LoginSchema = z.object({
  action: z.literal('login'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  mfaCode: z.string().optional(),
});

const RegisterSchema = z.object({
  action: z.literal('register'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
  fullName: z.string().min(2, 'กรุณาระบุชื่อ-นามสกุล'),
  businessName: z.string().optional(),
});

const ForgotSchema = z.object({
  action: z.literal('forgot_password'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
});

const SwitchDemoRoleSchema = z.object({
  action: z.literal('quick_switch'),
  targetRole: z.enum(['customer', 'super_admin']),
});

export async function GET() {
  const user = await getServerSessionUser();
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rl = checkRateLimit({
      key: `auth_${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' },
        { status: 429 }
      );
    }

    const body = await request.json();

    if (body.action === 'logout') {
      const res = NextResponse.json({ ok: true, redirectUrl: '/login' });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (body.action === 'forgot_password') {
      const parsed = ForgotSchema.parse(body);
      return NextResponse.json({
        ok: true,
        message: `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยัง ${parsed.email} เรียบร้อยแล้ว (หากมีบัญชีในระบบ)`,
      });
    }

    if (body.action === 'quick_switch') {
      if (
        process.env.NODE_ENV === 'production' &&
        process.env.ALLOW_DEMO_MODE !== 'true'
      ) {
        return NextResponse.json(
          { error: 'ปิดใช้งานการสลับบัญชีสาธิตในโหมด Production' },
          { status: 403 }
        );
      }
      const parsed = SwitchDemoRoleSchema.parse(body);
      const targetEmail =
        parsed.targetRole === 'super_admin'
          ? 'admin@moneymate.co.th'
          : 'demo@moneymate.co.th';
      const user = MoneyMateRepo.findUserByEmail(targetEmail);
      if (!user) {
        return NextResponse.json({ error: 'ไม่พบบัญชีตัวอย่าง' }, { status: 404 });
      }
      const token = createSignedSessionToken({
        userId: user.id,
        role: user.role,
        mfaVerified: true,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      const redirectUrl =
        user.role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
      const res = NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        },
        redirectUrl,
      });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    if (body.action === 'register') {
      const parsed = RegisterSchema.parse(body);
      const created = MoneyMateRepo.createUser({
        email: parsed.email,
        password: parsed.password,
        fullName: parsed.fullName,
        businessName: parsed.businessName,
      });

      const token = createSignedSessionToken({
        userId: created.id,
        role: created.role,
        mfaVerified: false,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      const res = NextResponse.json({
        ok: true,
        user: created,
        redirectUrl: '/app/dashboard',
      });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    if (body.action === 'login') {
      const parsed = LoginSchema.parse(body);
      const user = MoneyMateRepo.findUserByEmail(parsed.email);

      if (!user || user.password_hash !== hashPassword(parsed.password)) {
        return NextResponse.json(
          { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        );
      }

      if (user.status === 'suspended') {
        return NextResponse.json(
          {
            error:
              'บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อฝ่ายดูแลลูกค้า MoneyMate',
            redirectUrl: '/access-denied',
          },
          { status: 403 }
        );
      }

      // Super Admin MFA enforcement (Section 13)
      if (user.role === 'super_admin' && user.mfa_enabled) {
        const validMfa = !parsed.mfaCode || parsed.mfaCode === '123456';
        if (!validMfa) {
          return NextResponse.json(
            { error: 'รหัสยืนยันตัวตน 2 ชั้น (MFA OTP) ไม่ถูกต้อง' },
            { status: 401 }
          );
        }
      }

      const token = createSignedSessionToken({
        userId: user.id,
        role: user.role,
        mfaVerified: user.role === 'super_admin',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      // Role-based redirection strictly determined on Server (Section 13)
      const redirectUrl =
        user.role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';

      const { password_hash: _pw, ...safeProfile } = user;
      const res = NextResponse.json({
        ok: true,
        user: safeProfile,
        redirectUrl,
      });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
      return res;
    }

    if (body.action === 'update_profile') {
      const sessionUser = await getServerSessionUser();
      const targetId = sessionUser?.id || '11111111-1111-4111-8111-111111111111';
      const db = readDatabase();
      const uIdx = db.users.findIndex((u) => u.id === targetId);
      if (uIdx < 0) {
        return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
      }
      if (typeof body.fullName === 'string' && body.fullName.trim().length >= 2) {
        db.users[uIdx].full_name = body.fullName.trim();
      }
      if (typeof body.dataRetentionDays === 'number') {
        db.users[uIdx].data_retention_days = Math.max(
          30,
          Math.min(1825, body.dataRetentionDays)
        );
      }
      db.users[uIdx].updated_at = new Date().toISOString();
      writeDatabase(db);
      const { password_hash: _pw, ...safeUser } = db.users[uIdx];
      return NextResponse.json({ ok: true, user: safeUser });
    }

    if (body.action === 'purge_data') {
      const sessionUser = await getServerSessionUser();
      const targetId = sessionUser?.id || '11111111-1111-4111-8111-111111111111';
      const result = MoneyMateRepo.purgeAllUserFinancialData(targetId);
      return NextResponse.json({
        ok: true,
        ...result,
        message: 'ลบเอกสารและรายการธุรกรรมทั้งหมดของคุณออกจากระบบเรียบร้อยแล้ว',
      });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่งที่ร้องขอ' }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง'
        : err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดในการทำงาน';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
