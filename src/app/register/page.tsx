'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          fullName,
          businessName,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'ไม่สามารถสมัครสมาชิกได้');
        setLoading(false);
        return;
      }
      router.push(data.redirectUrl || '/app/dashboard');
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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
              src="/brand/sticker-fighting.png"
              alt="สู้ๆ รับฟรี 5 เครดิต"
              width={64}
              height={64}
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-ink pt-1">
            สร้างบัญชีใหม่ (รับฟรี 5 เครดิต)
          </h1>
          <p className="text-xs text-ink-secondary">
            เริ่มต้นใช้งานระบบจัดการสลิปและใบเสร็จด้วย AI แยกข้อมูลส่วนตัวปลอดภัย 100%
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

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label
              htmlFor="reg-fullname"
              className="block text-xs font-medium text-ink mb-1"
            >
              ชื่อ-นามสกุล (ใช้เปรียบเทียบชื่อผู้โอน/ผู้รับในสลิป)
            </label>
            <input
              id="reg-fullname"
              type="text"
              required
              placeholder="เช่น สมชาย ใจดี"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="reg-business"
              className="block text-xs font-medium text-ink mb-1"
            >
              ชื่อร้านค้า / ชื่อธุรกิจ
            </label>
            <input
              id="reg-business"
              type="text"
              placeholder="เช่น ร้านมณีเมท สตูดิโอ"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-xs font-medium text-ink mb-1"
            >
              อีเมล (Email)
            </label>
            <input
              id="reg-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="reg-password"
              className="block text-xs font-medium text-ink mb-1"
            >
              รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {loading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิกและรับฟรี 5 เครดิต'}
            </span>
          </button>
        </form>

        <p className="text-xs text-center text-ink-secondary">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            เข้าสู่ระบบที่นี่
          </Link>
        </p>
      </div>
    </div>
  );
}
