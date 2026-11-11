'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email,
          password,
          mfaCode: mfaCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน');
        setLoading(false);
        return;
      }
      router.push(data.redirectUrl || '/app/dashboard');
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md mm-card-outer p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center justify-between pb-2">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/brand/logo-header.png?v=3"
                alt="MoneyMate เพื่อนช่วยจัดการเงิน"
                width={150}
                height={38}
                priority
                className="h-8 w-auto object-contain"
              />
            </Link>
            <Image
              src="/brand/sticker-phone.png"
              alt="จัดการการเงินง่ายๆ กับ MoneyMate"
              width={64}
              height={64}
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-ink pt-1">เข้าสู่ระบบ</h1>
          <p className="text-xs text-ink-secondary">
            เข้าสู่ระบบเพื่อจัดการสลิป ใบเสร็จ และงบการเงินร้านค้าของคุณ
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-inner bg-expense-soft border border-expense/30 text-xs font-medium text-expense"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-ink mb-1"
            >
              อีเมล (Email)
            </label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-ink"
              >
                รหัสผ่าน (Password)
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand hover:underline"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm focus:outline-none focus:border-brand"
            />
          </div>

          {email.toLowerCase().includes('admin') && (
            <div>
              <label
                htmlFor="login-mfa"
                className="block text-xs font-medium text-ink mb-1"
              >
                รหัสยืนยันตัวตน 2 ชั้น (MFA OTP)
              </label>
              <input
                id="login-mfa"
                type="text"
                placeholder="กรอกรหัส 6 หลัก"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm font-mono tabular-nums focus:outline-none focus:border-brand"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}</span>
          </button>
        </form>

        <p className="text-xs text-center text-ink-secondary">
          ยังไม่มีบัญชีผู้ใช้?{' '}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            สมัครสมาชิกรับฟรี 5 เครดิต
          </Link>
        </p>
      </div>
    </div>
  );
}
