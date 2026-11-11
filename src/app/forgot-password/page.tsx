'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MailCheck, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forgot_password', email }),
    });
    const data = await res.json();
    setSentMessage(
      data.message || 'ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณเรียบร้อยแล้ว'
    );
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md mm-card-outer p-6 sm:p-8 space-y-5">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับไปหน้าเข้าสู่ระบบ</span>
        </Link>

        <h1 className="text-2xl font-bold text-ink">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-xs text-ink-secondary">
          กรอกอีเมลที่ใช้สมัคร MoneyMate ระบบจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้ทางอีเมล
        </p>

        {sentMessage ? (
          <div className="p-4 rounded-inner bg-income-soft border border-income/30 text-xs text-income space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <MailCheck className="w-4 h-4" />
              <span>ส่งคำขอสำเร็จ</span>
            </div>
            <p>{sentMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs font-medium text-ink mb-1"
              >
                อีเมลของคุณ
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-inner border border-border-strong text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
            >
              {loading ? 'กำลังส่งลิงก์...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
