'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  Activity,
  ListOrdered,
  Tags,
  FileBarChart2,
  Coins,
  QrCode,
  Receipt,
  Building2,
  UserCog,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

const CUSTOMER_NAV_ITEMS = [
  { href: '/app/dashboard', label: 'แดชบอร์ดการเงิน', icon: LayoutDashboard },
  { href: '/app/upload', label: 'อัปโหลดสลิป / ใบเสร็จ', icon: UploadCloud },
  { href: '/app/processing', label: 'สถานะประมวลผล AI', icon: Activity },
  { href: '/app/transactions', label: 'รายการธุรกรรมทั้งหมด', icon: ListOrdered },
  { href: '/app/categories', label: 'จัดการหมวดหมู่', icon: Tags },
  { href: '/app/reports', label: 'รายงานการเงิน & VAT', icon: FileBarChart2 },
  { href: '/app/credits', label: 'กระเป๋าเครดิต & ประวัติ', icon: Coins },
  { href: '/app/checkout', label: 'เติมเครดิต PromptPay', icon: QrCode },
  { href: '/app/payments', label: 'ประวัติการชำระเงิน', icon: Receipt },
  { href: '/app/settings/business', label: 'ตั้งค่าบัญชีธุรกิจ', icon: Building2 },
  { href: '/app/settings/account', label: 'ตั้งค่าบัญชีส่วนตัว', icon: UserCog },
];

const MOBILE_BOTTOM_TABS = [
  { href: '/app/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { href: '/app/upload', label: 'สแกนสลิป', icon: UploadCloud },
  { href: '/app/transactions', label: 'ธุรกรรม', icon: ListOrdered },
  { href: '/app/checkout', label: 'เติมเครดิต', icon: QrCode },
];

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('สมชาย ใจดี');
  const [businessName, setBusinessName] = useState<string>('ร้านมณีเมท สตูดิโอ');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((d) => {
        if (d.wallet && typeof d.wallet.balance === 'number') {
          setCreditBalance(d.wallet.balance);
        }
        if (d.user?.full_name) setUserName(d.user.full_name);
        if (d.business?.business_name) setBusinessName(d.business.business_name);
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-background text-ink pb-16 lg:pb-0">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-surface border-r border-border shrink-0">
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand/logo-header.png?v=3"
              alt="MoneyMate เพื่อนช่วยจัดการเงิน"
              width={140}
              height={36}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Business & Credit Pill with Mascot Sticker */}
        <div className="p-4 border-b border-border space-y-2.5">
          <div className="px-3 py-2 rounded-inner bg-surface-muted flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-ink-muted">ธุรกิจที่กำลังใช้งาน</p>
              <p className="text-xs font-semibold text-ink truncate">
                {businessName}
              </p>
              <p className="text-[11px] text-ink-secondary truncate">{userName}</p>
            </div>
            <Image
              src="/brand/sticker-saving.png"
              alt="ออมเงินกันเถอะ"
              width={36}
              height={36}
              className="w-9 h-9 object-contain shrink-0"
            />
          </div>

          <div className="px-3 py-2.5 rounded-inner bg-brand-soft border border-brand/20 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-brand font-medium">
                เครดิตคงเหลือ
              </p>
              <p className="text-base font-bold text-brand tabular-nums">
                {creditBalance !== null ? `${creditBalance} รูป` : '...'}
              </p>
            </div>
            <Link
              href="/app/checkout"
              className="px-2.5 py-1 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
            >
              เติมเครดิต
            </Link>
          </div>
        </div>

        <nav
          aria-label="เมนูพอร์ทัลลูกค้า"
          className="flex-1 p-3 space-y-1 overflow-y-auto"
        >
          {CUSTOMER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-inner text-xs font-medium mm-interactive ${
                  active
                    ? 'bg-brand text-white font-semibold'
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 px-4 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={mobileOpen ? 'ปิดเมนูนำทาง' : 'เปิดเมนูนำทาง'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-inner border border-border text-ink mm-interactive"
            >
              {mobileOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
            <Link href="/" className="flex items-center">
              <Image
                src="/brand/logo-header.png?v=3"
                alt="MoneyMate"
                width={120}
                height={30}
                className="h-6 w-auto object-contain"
              />
            </Link>
          </div>
          <Link
            href="/app/checkout"
            className="px-2.5 py-1 text-xs font-semibold bg-brand-soft text-brand rounded-inner tabular-nums mm-interactive"
          >
            เครดิต: {creditBalance ?? '...'}
          </Link>
        </header>

        {mobileOpen && (
          <nav
            aria-label="เมนูพอร์ทัลลูกค้าสำหรับมือถือ"
            className="lg:hidden bg-surface border-b border-border p-3 space-y-1 shadow-md"
          >
            {CUSTOMER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-inner text-xs font-medium text-ink-secondary hover:bg-surface-muted mm-interactive"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Thumbs-First Bottom Tab Bar (/impeccable adapt) */}
        <nav
          aria-label="แถบลัดด้านล่างสำหรับมือถือ"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border px-2 py-1.5 grid grid-cols-4 gap-1"
        >
          {MOBILE_BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-1.5 rounded-inner text-[11px] font-medium mm-interactive ${
                  active
                    ? 'text-brand font-semibold bg-brand-soft/60'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
