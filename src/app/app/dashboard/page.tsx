'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Building2,
  Check,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import type { DashboardSummary } from '@/types/domain';
import {
  formatTHB,
  formatThaiDate,
  getBangkokISODate,
} from '@/lib/utils/formatters';

type PresetPeriod = 'today' | '7d' | 'this_month' | 'last_month' | 'all' | 'custom';

export default function CustomerDashboardPage() {
  const [period, setPeriod] = useState<PresetPeriod>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Onboarding Checklist State (/impeccable onboard)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    business: true,
    upload: true,
    export: false,
  });

  const toggleOnboardingStep = (stepKey: string) => {
    setCompletedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const onboardingProgress = Math.round((completedCount / 3) * 100);

  const computePresetDates = (preset: PresetPeriod) => {
    const todayStr = getBangkokISODate();
    const now = new Date(`${todayStr}T00:00:00+07:00`);

    if (preset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (preset === '7d') {
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { start: getBangkokISODate(past), end: todayStr };
    }
    if (preset === 'this_month') {
      const start = `${todayStr.slice(0, 7)}-01`;
      return { start, end: todayStr };
    }
    if (preset === 'last_month') {
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const firstLastMonth = new Date(Date.UTC(year, month - 1, 1));
      const lastLastMonth = new Date(Date.UTC(year, month, 0));
      return {
        start: firstLastMonth.toISOString().slice(0, 10),
        end: lastLastMonth.toISOString().slice(0, 10),
      };
    }
    return { start: '', end: '' };
  };

  const loadDashboard = useCallback(
    async (sDate: string, eDate: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (sDate) params.set('startDate', sDate);
        if (eDate) params.set('endDate', eDate);
        const res = await fetch(`/api/transactions?${params.toString()}`);
        const data = await res.json();
        if (data.summary) {
          setSummary(data.summary);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (period !== 'custom') {
      const { start, end } = computePresetDates(period);
      setStartDate(start);
      setEndDate(end);
      loadDashboard(start, end);
    }
  }, [period, loadDashboard]);

  const exportQueryString = () => {
    const p = new URLSearchParams();
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return p.toString() ? `?${p.toString()}` : '';
  };

  return (
    <div className="space-y-7">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Image
            src="/brand/sticker-plan.png"
            alt="วางแผนการเงินกันกับ MoneyMate"
            width={60}
            height={60}
            priority
            className="w-15 h-15 object-contain shrink-0 mm-sticker-pop"
          />
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">
              แดชบอร์ดสรุปรายรับ-รายจ่าย (Financial Dashboard)
            </h1>
            <p className="text-xs text-ink-secondary mt-0.5">
              คำนวณเฉพาะรายการที่ยืนยันแล้ว (Confirmed) ไม่รวมสลิปซ้ำ รายการรอตรวจสอบ หรือโอนระหว่างบัญชีร้านตัวเอง
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`/api/export/excel${exportQueryString()}`}
            onClick={() => setCompletedSteps((prev) => ({ ...prev, export: true }))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-surface border border-border-strong rounded-inner hover:bg-surface-muted mm-interactive"
          >
            <FileSpreadsheet className="w-4 h-4 text-income" />
            <span>Export Excel (.xlsx 5 ชีต)</span>
          </a>
          <a
            href={`/api/export/csv${exportQueryString()}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-surface border border-border-strong rounded-inner hover:bg-surface-muted mm-interactive"
          >
            <FileText className="w-4 h-4 text-brand" />
            <span>Export CSV</span>
          </a>
          <Link
            href="/app/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
          >
            <UploadCloud className="w-4 h-4" />
            <span>อัปโหลดสลิป / ใบเสร็จ</span>
          </Link>
        </div>
      </div>

      {/* First-Run Onboarding Checklist (/impeccable onboard & delight) */}
      {showOnboarding && (
        <section
          aria-label="เช็กลิสต์เริ่มต้นใช้งานสำหรับร้านค้า"
          className="mm-card-outer p-5 bg-surface border-2 border-border-strong space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/sticker-goal-piggy.png"
                alt="เก็บเงินให้ถึงเป้าหมาย"
                width={48}
                height={48}
                className="w-12 h-12 object-contain shrink-0 mm-sticker-pop"
              />
              <div>
                <h2 className="text-sm sm:text-base font-display font-semibold text-brand">
                  เริ่มต้นตั้งค่าร้านค้าใน 3 ขั้นตอน เพื่อความแม่นยำในการคัดแยกบัญชี 100%
                </h2>
                <p className="text-xs text-ink-secondary">
                  สำเร็จแล้ว {completedCount} จาก 3 ขั้นตอน ({onboardingProgress}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28 h-2 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky mm-interactive"
                  style={{ width: `${onboardingProgress}%` }}
                />
              </div>
              <button
                type="button"
                aria-label="ซ่อนเช็กลิสต์เริ่มต้นใช้งาน"
                onClick={() => setShowOnboarding(false)}
                className="p-1.5 rounded-inner text-ink-muted hover:text-ink hover:bg-surface-muted mm-interactive"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-inner bg-background border border-border flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  aria-label="สลับสถานะขั้นตอนที่ 1 ตั้งค่าบัญชีธุรกิจ"
                  onClick={() => toggleOnboardingStep('business')}
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border shrink-0 mm-interactive ${
                    completedSteps.business
                      ? 'bg-sky text-white border-sky'
                      : 'bg-surface border-border-strong text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <div>
                  <p className="font-semibold text-ink">1. ผูกชื่อร้านและเลขบัญชีธุรกิจ</p>
                  <p className="text-ink-muted mt-0.5">
                    เพื่อให้ AI แยกเงินเข้า (รายรับ) และเงินออก (รายจ่าย) อัตโนมัติ
                  </p>
                </div>
              </div>
              <Link
                href="/app/settings/business"
                className="shrink-0 font-semibold text-brand hover:underline"
              >
                ตั้งค่า →
              </Link>
            </div>

            <div className="p-3.5 rounded-inner bg-background border border-border flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  aria-label="สลับสถานะขั้นตอนที่ 2 อัปโหลดสลิปชุดแรก"
                  onClick={() => toggleOnboardingStep('upload')}
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border shrink-0 mm-interactive ${
                    completedSteps.upload
                      ? 'bg-sky text-white border-sky'
                      : 'bg-surface border-border-strong text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <div>
                  <p className="font-semibold text-ink">2. ทดลองอัปโหลดสลิป 4 เคส</p>
                  <p className="text-ink-muted mt-0.5">
                    ทดสอบทั้งสลิปรายรับ ใบกำกับภาษี VAT 7% และระบบคัดสลิปซ้ำ
                  </p>
                </div>
              </div>
              <Link
                href="/app/upload"
                className="shrink-0 font-semibold text-brand hover:underline"
              >
                อัปโหลด →
              </Link>
            </div>

            <div className="p-3.5 rounded-inner bg-background border border-border flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  aria-label="สลับสถานะขั้นตอนที่ 3 ส่งออกงบการเงิน Excel"
                  onClick={() => toggleOnboardingStep('export')}
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border shrink-0 mm-interactive ${
                    completedSteps.export
                      ? 'bg-sky text-white border-sky'
                      : 'bg-surface border-border-strong text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <div>
                  <p className="font-semibold text-ink">3. ดาวน์โหลดงบ Excel 5 ชีต</p>
                  <p className="text-ink-muted mt-0.5">
                    รับไฟล์ .xlsx แยกชีตสรุปงบ รายรับ รายจ่าย และหมวดหมู่
                  </p>
                </div>
              </div>
              <a
                href={`/api/export/excel${exportQueryString()}`}
                onClick={() => setCompletedSteps((prev) => ({ ...prev, export: true }))}
                className="shrink-0 font-semibold text-sky hover:underline"
              >
                ดาวน์โหลด →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Period Filter Bar */}
      <div className="mm-card-outer p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'today', label: 'วันนี้' },
              { id: '7d', label: '7 วันล่าสุด' },
              { id: 'this_month', label: 'เดือนนี้' },
              { id: 'last_month', label: 'เดือนก่อน' },
              { id: 'custom', label: 'กำหนดช่วงวันที่เอง' },
            ] as Array<{ id: PresetPeriod; label: string }>
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setPeriod(btn.id)}
              className={`px-3 py-1.5 rounded-inner text-xs font-semibold mm-interactive ${
                period === btn.id
                  ? 'bg-brand text-white'
                  : 'bg-surface-muted text-ink-secondary hover:text-ink'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="dash-start-date" className="text-ink-secondary">
              ตั้งแต่:
            </label>
            <input
              id="dash-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-inner border border-border-strong"
            />
            <label htmlFor="dash-end-date" className="text-ink-secondary">
              ถึง:
            </label>
            <input
              id="dash-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-inner border border-border-strong"
            />
            <button
              type="button"
              onClick={() => loadDashboard(startDate, endDate)}
              className="px-3 py-1.5 bg-brand text-white font-semibold rounded-inner mm-interactive"
            >
              กรองข้อมูล
            </button>
          </div>
        )}
      </div>

      {/* Unified 3-Column Kakeibo Ledger Summary Sheet */}
      <div className="mm-card-outer overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-border">
          <div className="p-5 space-y-2 bg-surface">
            <div className="flex items-center justify-between text-xs font-semibold text-sky pb-2 border-b border-border">
              <span>รายรับรวมที่ยืนยันแล้ว (Total Income)</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-semibold text-sky tabular-nums">
              {loading ? '...' : formatTHB(summary?.total_income ?? 0)}
            </p>
            <p className="text-xs text-ink-muted tabular-nums">
              ภาษีขาย (VAT): {formatTHB(summary?.vat_summary.income_vat_total ?? 0)}
            </p>
          </div>

          <div className="p-5 space-y-2 bg-surface">
            <div className="flex items-center justify-between text-xs font-semibold text-expense pb-2 border-b border-border">
              <span>รายจ่ายรวมที่ยืนยันแล้ว (Total Expense)</span>
              <TrendingDown className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-semibold text-expense tabular-nums">
              {loading ? '...' : formatTHB(summary?.total_expense ?? 0)}
            </p>
            <p className="text-xs text-ink-muted tabular-nums">
              ภาษีซื้อ (VAT): {formatTHB(summary?.vat_summary.expense_vat_total ?? 0)}
            </p>
          </div>

          <div className="p-5 space-y-2 bg-surface-muted/40">
            <div className="flex items-center justify-between text-xs font-semibold text-brand pb-2 mm-double-rule-red">
              <span>ยอดคงเหลือสุทธิ (Net = รายรับ - รายจ่าย)</span>
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-semibold text-brand tabular-nums">
              {loading ? '...' : formatTHB(summary?.net_amount ?? 0)}
            </p>
            <p className="text-xs text-ink-secondary tabular-nums">
              จากรายการที่ยืนยันแล้ว {summary?.confirmed_count ?? 0} รายการ
            </p>
          </div>
        </div>
      </div>

      {/* Pending Review Alert Banner */}
      {summary && summary.pending_review_count > 0 && (
        <div className="p-4 rounded-inner bg-warning-soft border border-warning/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-warning">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              มีรายการที่รอการตรวจสอบด้วยตนเอง (Pending Review) จำนวน{' '}
              <strong className="tabular-nums">
                {summary.pending_review_count}
              </strong>{' '}
              รายการ ซึ่งยังไม่ถูกนำมารวมในยอดสุทธิด้านบน
            </span>
          </div>
          <Link
            href="/app/transactions?status=pending_review"
            className="px-3 py-1.5 text-xs font-semibold bg-warning text-white rounded-inner shrink-0 mm-interactive"
          >
            ตรวจสอบและยืนยันรายการ
          </Link>
        </div>
      )}

      {/* Charts Grid: Daily & Monthly Income vs Expense + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 mm-card-outer p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">
              เปรียบเทียบรายรับและรายจ่ายรายวัน (Daily Cashflow)
            </h2>
            <span className="text-xs text-ink-muted">หน่วย: บาท (฿)</span>
          </div>
          <div className="h-64 w-full">
            {summary && summary.daily_series.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.daily_series}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: number) => formatTHB(val)}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar
                    dataKey="income"
                    name="รายรับ"
                    fill="#0284C7"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    name="รายจ่าย"
                    fill="#DC2626"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-xs text-ink-muted">
                <Image
                  src="/brand/sticker-sleep.png"
                  alt="ไม่มีข้อมูลธุรกรรมในช่วงวันที่เลือก"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain opacity-90"
                />
                <p className="font-semibold text-ink-secondary">
                  ยังไม่มีรายการที่ยืนยันแล้วในช่วงวันที่ที่เลือก
                </p>
                {period !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setPeriod('all')}
                    className="px-3 py-1 rounded-inner bg-brand-soft text-brand font-semibold hover:bg-brand hover:text-white mm-interactive"
                  >
                    สลับไปดูรายการทั้งหมด
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 mm-card-outer p-5 space-y-4">
          <h2 className="text-sm font-bold text-ink">
            สัดส่วนรายจ่ายแยกตามหมวดหมู่ (Top Expense Categories)
          </h2>
          {summary && summary.expense_by_category.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.expense_by_category}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {summary.expense_by_category.map((entry) => (
                        <Cell key={entry.category} fill={entry.color_hex} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatTHB(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {summary.expense_by_category.map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-inner"
                        style={{ backgroundColor: cat.color_hex }}
                      />
                      <span className="font-medium text-ink">
                        {cat.category}
                      </span>
                      <span className="text-ink-muted tabular-nums">
                        ({cat.count} รายการ)
                      </span>
                    </div>
                    <div className="font-semibold text-ink tabular-nums">
                      {formatTHB(cat.amount)}{' '}
                      <span className="text-ink-muted font-normal">
                        ({cat.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center gap-2 text-xs text-ink-muted">
              <Image
                src="/brand/sticker-sleep.png"
                alt="ยังไม่มีรายจ่ายในช่วงเวลานี้"
                width={52}
                height={52}
                className="w-13 h-13 object-contain opacity-90"
              />
              <span>ยังไม่มีรายการรายจ่ายที่ยืนยันแล้วในช่วงเวลานี้</span>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Overview + Recent Transactions */}
      <div className="mm-card-outer p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink">
              รายการธุรกรรมล่าสุด (Recent Transactions)
            </h2>
            <p className="text-xs text-ink-muted">
              คลิกที่วันที่ของรายการเพื่อดูภาพสลิปต้นฉบับหรือแก้ไขหมวดหมู่และจำนวนเงิน
            </p>
          </div>
          <Link
            href="/app/transactions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            <span>ดูทั้งหมด</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th className="py-2.5 pr-3 font-medium">วันที่ / เวลา</th>
                <th className="py-2.5 px-3 font-medium">ประเภท</th>
                <th className="py-2.5 px-3 font-medium">ผู้โอน → ผู้รับ / ร้านค้า</th>
                <th className="py-2.5 px-3 font-medium">หมวดหมู่</th>
                <th className="py-2.5 px-3 font-medium">สถานะ</th>
                <th className="py-2.5 pl-3 font-medium text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(summary?.recent_transactions || []).map((tx) => (
                <tr key={tx.id} className="hover:bg-surface-muted/60">
                  <td className="py-3 pr-3 tabular-nums">
                    <Link
                      href={`/app/transactions/${tx.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {formatThaiDate(tx.transaction_date)}
                    </Link>
                    <p className="text-ink-muted">{tx.transaction_time || '-'}</p>
                  </td>
                  <td className="py-3 px-3">
                    {tx.direction === 'income' && (
                      <span className="px-2 py-0.5 rounded-inner bg-income-soft text-income font-semibold">
                        รายรับ
                      </span>
                    )}
                    {tx.direction === 'expense' && (
                      <span className="px-2 py-0.5 rounded-inner bg-expense-soft text-expense font-semibold">
                        รายจ่าย
                      </span>
                    )}
                    {tx.direction === 'internal_transfer' && (
                      <span className="px-2 py-0.5 rounded-inner bg-surface-muted text-ink-secondary font-semibold">
                        โอนบัญชีตัวเอง
                      </span>
                    )}
                    {tx.direction === 'needs_review' && (
                      <span className="px-2 py-0.5 rounded-inner bg-warning-soft text-warning font-semibold">
                        รอตรวจสอบ
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-ink">
                      {tx.sender_name || '-'} →{' '}
                      {tx.receiver_name || tx.merchant_name || '-'}
                    </p>
                    <p className="text-ink-muted truncate max-w-xs">
                      {tx.description || tx.notes || '-'}
                    </p>
                  </td>
                  <td className="py-3 px-3 text-ink-secondary">
                    {tx.category_name}
                  </td>
                  <td className="py-3 px-3">
                    {tx.status === 'confirmed' ? (
                      <span className="inline-flex items-center gap-1 text-income font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ยืนยันแล้ว
                      </span>
                    ) : tx.status === 'pending_review' ? (
                      <span className="text-warning font-semibold">
                        รอตรวจสอบ
                      </span>
                    ) : (
                      <span className="text-ink-muted">{tx.status}</span>
                    )}
                  </td>
                  <td
                    className={`py-3 pl-3 text-right font-bold tabular-nums ${
                      tx.direction === 'income'
                        ? 'text-income'
                        : tx.direction === 'expense'
                          ? 'text-expense'
                          : 'text-ink-secondary'
                    }`}
                  >
                    {tx.direction === 'income'
                      ? '+'
                      : tx.direction === 'expense'
                        ? '-'
                        : ''}
                    {formatTHB(tx.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Accounting & Tax Disclaimer (Section 3.8) */}
      <div className="p-4 rounded-inner bg-surface-muted border border-border text-xs text-ink-secondary">
        {summary?.disclaimer ||
          'หมายเหตุ: ยอดสุทธิเป็นการคำนวณจากรายการที่บันทึกและยืนยันแล้วในระบบ ไม่ใช่การรับรองกำไรทางบัญชีหรือภาษี'}
      </div>
    </div>
  );
}
