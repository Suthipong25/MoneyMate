'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, ArrowUpRight, History, Sparkles } from 'lucide-react';
import type {
  CreditLedgerEntry,
  CreditPackage,
  CreditWallet,
} from '@/types/domain';
import { formatTHB, formatThaiDate } from '@/lib/utils/formatters';

export default function CreditManagementPage() {
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'topup' | 'usage'>('all');

  useEffect(() => {
    fetch('/api/payments/create-qr')
      .then((r) => r.json())
      .then((d) => {
        if (d.wallet) setWallet(d.wallet);
        if (d.ledger) setLedger(d.ledger);
        if (d.packages) setPackages(d.packages);
      });
  }, []);

  const filteredLedger = ledger.filter((entry) => {
    if (activeTab === 'topup') return entry.delta > 0;
    if (activeTab === 'usage') return entry.delta < 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            กระเป๋าเครดิตและประวัติการใช้งาน (Credit Management)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            ระบบตัดเครดิตแบบ Atomic Transaction: หัก 1 เครดิตเฉพาะรูปที่ประมวลผลสำเร็จและไม่ซ้ำเท่านั้น
          </p>
        </div>
        <Link
          href="/app/checkout"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
        >
          <Coins className="w-4 h-4" />
          <span>เติมเครดิตผ่าน QR PromptPay</span>
        </Link>
      </div>

      {/* Wallet Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="mm-card-outer p-5 space-y-1 border-l-4 border-l-brand">
          <p className="text-xs text-ink-secondary">เครดิตคงเหลือพร้อมใช้งาน</p>
          <p className="text-3xl font-bold text-brand tabular-nums">
            {wallet?.balance ?? 0} เครดิต
          </p>
          <p className="text-[11px] text-ink-muted">1 เครดิต = 1 รูปที่ไม่ซ้ำ</p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <p className="text-xs text-ink-secondary">เครดิตที่ซื้อสะสมทั้งหมด</p>
          <p className="text-2xl font-bold text-income tabular-nums">
            +{wallet?.lifetime_purchased ?? 0} เครดิต
          </p>
          <p className="text-[11px] text-ink-muted">เครดิตไม่มีวันหมดอายุ</p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <p className="text-xs text-ink-secondary">เครดิตที่ใช้สแกนสำเร็จสะสม</p>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {wallet?.lifetime_used ?? 0} รูป
          </p>
          <p className="text-[11px] text-ink-muted">
            รูปเสียและสลิปซ้ำไม่ถูกนับหักเครดิต
          </p>
        </div>
      </div>

      {/* Available Packages */}
      <div className="mm-card-outer p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-brand">
          <Sparkles className="w-4 h-4" />
          <span>แพ็กเกจเครดิต Pay-Per-Use (เติมผ่าน QR PromptPay)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="p-4 rounded-inner border border-border flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">{pkg.code}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-inner bg-brand-soft text-brand tabular-nums">
                    {pkg.credits} เครดิต
                  </span>
                </div>
                <p className="text-sm font-semibold text-ink mt-1">
                  {pkg.name}
                </p>
                <p className="text-2xl font-bold text-ink tabular-nums mt-1">
                  {formatTHB(pkg.price_thb)}
                </p>
                <p className="text-xs text-ink-secondary mt-1">
                  {pkg.description}
                </p>
              </div>

              {pkg.price_thb > 0 ? (
                <Link
                  href={`/app/checkout?package=${pkg.code}`}
                  className="inline-flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
                >
                  <span>เลือกซื้อแพ็กเกจ {pkg.code}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="py-2 px-3 text-center text-xs font-medium bg-surface-muted text-ink-muted rounded-inner">
                  ได้รับอัตโนมัติเมื่อสมัครสมาชิก
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Credit & Usage Ledger History */}
      <div className="mm-card-outer p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-bold text-ink">
              ประวัติการเปลี่ยนแปลงเครดิต (Credit & Usage Ledger)
            </h2>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-inner font-semibold ${
                activeTab === 'all'
                  ? 'bg-brand text-white'
                  : 'bg-surface-muted text-ink-secondary'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('topup')}
              className={`px-3 py-1 rounded-inner font-semibold ${
                activeTab === 'topup'
                  ? 'bg-brand text-white'
                  : 'bg-surface-muted text-ink-secondary'
              }`}
            >
              ประวัติเติมเครดิต (+)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('usage')}
              className={`px-3 py-1 rounded-inner font-semibold ${
                activeTab === 'usage'
                  ? 'bg-brand text-white'
                  : 'bg-surface-muted text-ink-secondary'
              }`}
            >
              ประวัติการใช้เครดิต (-)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-secondary">
                <th className="py-2.5 pr-3">วัน-เวลา</th>
                <th className="py-2.5 px-3">รายการ / เหตุผล</th>
                <th className="py-2.5 px-3">รหัสอ้างอิง (Idempotency)</th>
                <th className="py-2.5 px-3 text-right">เปลี่ยนแปลง</th>
                <th className="py-2.5 pl-3 text-right">คงเหลือหลังทำรายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLedger.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {formatThaiDate(item.created_at)}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-ink">
                    {item.reason}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-ink-muted">
                    {item.idempotency_key}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                      item.delta > 0 ? 'text-income' : 'text-expense'
                    }`}
                  >
                    {item.delta > 0 ? `+${item.delta}` : item.delta}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-ink tabular-nums">
                    {item.balance_after} เครดิต
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
