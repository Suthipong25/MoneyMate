import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full mm-card-outer p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-inner bg-expense-soft text-expense flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-ink">
          ไม่มีสิทธิ์เข้าถึงหน้านี้ (Access Denied)
        </h1>
        <p className="text-xs text-ink-secondary leading-relaxed">
          หน้านี้จำกัดสิทธิ์เฉพาะผู้ดูแลระบบสูงสุด (Super Admin) ที่ยืนยันตัวตนด้วย MFA แล้ว หรือบัญชีของคุณอาจถูกระงับการใช้งานชั่วคราว
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/app/dashboard"
            className="px-4 py-2 text-xs font-semibold bg-surface border border-border-strong rounded-inner hover:bg-surface-muted"
          >
            กลับไปหน้าแดชบอร์ดลูกค้า
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
          >
            สลับบัญชีเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
