'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Cpu,
  Tags,
  ScrollText,
  ArrowLeftRight,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const ADMIN_NAV_ITEMS = [
  { href: '/admin/dashboard', label: '1. ภาพรวมระบบ (Overview)', icon: LayoutDashboard },
  { href: '/admin/users', label: '2. จัดการผู้ใช้งาน (Users)', icon: Users },
  { href: '/admin/payments', label: '3. รายการชำระเงิน (Payments)', icon: CreditCard },
  { href: '/admin/packages', label: '4. แพ็กเกจเครดิต (Packages)', icon: Package },
  { href: '/admin/jobs', label: '5. คิวงาน AI (AI Jobs)', icon: Cpu },
  { href: '/admin/categories', label: '6. หมวดหมู่กลาง (Categories)', icon: Tags },
  { href: '/admin/audit-logs', label: '7. บันทึกตรวจสอบ (Audit Logs)', icon: ScrollText },
];

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-background text-ink">
      {/* Dedicated Admin Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:w-64 bg-surface border-r border-border flex-col shrink-0">
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/brand/logo-header.png?v=3"
              alt="MoneyMate Admin"
              width={125}
              height={32}
              priority
              className="h-7 w-auto object-contain"
            />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ink text-white tracking-wider">
              ADMIN
            </span>
          </Link>
        </div>

        <div className="p-3 border-b border-border bg-warning-soft/70 text-[11px] text-warning font-medium">
          ทุกคำสั่งที่มีการเปลี่ยนแปลงสถานะบัญชี เครดิต หรือการชำระเงิน จะถูกบังคับระบุเหตุผลและบันทึกลง Audit Log ถาวร
        </div>

        <nav
          aria-label="เมนูผู้ดูแลระบบ"
          className="flex-1 p-3 space-y-1 overflow-y-auto"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-inner text-xs font-medium mm-interactive ${
                  active
                    ? 'bg-ink text-white font-semibold'
                    : 'text-ink-secondary hover:bg-surface-muted hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-inner text-xs font-medium text-expense hover:bg-expense-soft mm-interactive"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Responsive Mobile Header (320px / 200% Zoom Safe) */}
        <header className="lg:hidden h-14 px-4 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="เปิดเมนูผู้ดูแลระบบ"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-inner border border-border text-ink mm-interactive"
            >
              {mobileOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
            <span className="font-bold text-sm text-ink">
              MoneyMate Admin
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1 text-xs font-semibold text-expense hover:bg-expense-soft rounded-inner mm-interactive"
          >
            ออกจากระบบ
          </button>
        </header>

        {mobileOpen && (
          <nav
            aria-label="เมนูผู้ดูแลระบบสำหรับหน้าจอขนาดเล็ก"
            className="lg:hidden bg-surface border-b border-border p-3 space-y-1"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-inner text-xs font-medium text-ink-secondary hover:bg-surface-muted mm-interactive"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
