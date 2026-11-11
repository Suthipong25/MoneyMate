'use client';

import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Receipt } from 'lucide-react';
import type { DashboardSummary, TransactionRecord } from '@/types/domain';
import { formatTHB, formatThaiDate } from '@/lib/utils/formatters';

export default function FinancialReportsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReports = async (sDate = '', eDate = '') => {
    const params = new URLSearchParams();
    if (sDate) params.set('startDate', sDate);
    if (eDate) params.set('endDate', eDate);
    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    if (data.summary) setSummary(data.summary);
    if (data.transactions) setTransactions(data.transactions);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const vatDocs = transactions.filter(
    (t) =>
      t.status === 'confirmed' &&
      (t.vat_amount !== null || t.document_type === 'tax_invoice')
  );

  const exportParams = () => {
    const p = new URLSearchParams();
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return p.toString() ? `?${p.toString()}` : '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            รายงานการเงินและภาษีมูลค่าเพิ่ม (Financial & VAT Reports)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            สรุปข้อมูลตามที่ปรากฏบนเอกสารจริง (ห้ามคำนวณ VAT เองหากเอกสารต้นฉบับไม่ระบุชัดเจน) พร้อมส่งออก Excel 5 ชีต
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={`/api/export/excel${exportParams()}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ดาวน์โหลด Excel (.xlsx 5 ชีต)</span>
          </a>
          <a
            href={`/api/export/csv${exportParams()}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-surface border border-border-strong rounded-inner"
          >
            <FileText className="w-4 h-4" />
            <span>ดาวน์โหลด CSV</span>
          </a>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="mm-card-outer p-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold text-ink">เลือกช่วงวันที่สำหรับออกรายงาน:</span>
        <input
          type="date"
          aria-label="วันที่เริ่มต้นรายงาน"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-2.5 py-1.5 rounded-inner border border-border-strong"
        />
        <span>ถึง</span>
        <input
          type="date"
          aria-label="วันที่สิ้นสุดรายงาน"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-2.5 py-1.5 rounded-inner border border-border-strong"
        />
        <button
          type="button"
          onClick={() => loadReports(startDate, endDate)}
          className="px-3.5 py-1.5 bg-brand text-white font-semibold rounded-inner"
        >
          อัปเดตรายงาน
        </button>
      </div>

      {/* VAT Summary Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="mm-card-outer p-4 space-y-1">
          <p className="text-xs text-ink-secondary">ภาษีขายรวม (Income VAT)</p>
          <p className="text-xl font-bold text-income tabular-nums">
            {formatTHB(summary?.vat_summary.income_vat_total ?? 0)}
          </p>
        </div>
        <div className="mm-card-outer p-4 space-y-1">
          <p className="text-xs text-ink-secondary">ภาษีซื้อรวม (Expense VAT)</p>
          <p className="text-xl font-bold text-expense tabular-nums">
            {formatTHB(summary?.vat_summary.expense_vat_total ?? 0)}
          </p>
        </div>
        <div className="mm-card-outer p-4 space-y-1">
          <p className="text-xs text-ink-secondary">เอกสารราคารวม/แยก VAT ชัดเจน</p>
          <p className="text-xl font-bold text-brand tabular-nums">
            {(summary?.vat_summary.included_count ?? 0) +
              (summary?.vat_summary.excluded_count ?? 0)}{' '}
            รายการ
          </p>
        </div>
        <div className="mm-card-outer p-4 space-y-1">
          <p className="text-xs text-ink-secondary">ไม่มี VAT / ไม่ระบุ VAT</p>
          <p className="text-xl font-bold text-ink tabular-nums">
            {(summary?.vat_summary.none_count ?? 0) +
              (summary?.vat_summary.unknown_count ?? 0)}{' '}
            รายการ
          </p>
        </div>
      </div>

      {/* Tax Invoice & VAT Detail Table */}
      <div className="mm-card-outer p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-bold text-ink">
            รายการใบกำกับภาษีและเอกสารที่มีข้อมูล VAT ({vatDocs.length} รายการ)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-secondary">
                <th className="py-2.5 pr-3">วันที่</th>
                <th className="py-2.5 px-3">เลขที่ใบกำกับ / Ref</th>
                <th className="py-2.5 px-3">คู่ค้า / ร้านค้า</th>
                <th className="py-2.5 px-3">ประเภท</th>
                <th className="py-2.5 px-3 text-right">ยอดก่อน VAT</th>
                <th className="py-2.5 px-3 text-right">VAT (7%)</th>
                <th className="py-2.5 pl-3 text-right">ยอดสุทธิ (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vatDocs.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {formatThaiDate(tx.transaction_date)}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {tx.reference_id || '-'}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-ink">
                    {tx.merchant_name || tx.receiver_name || tx.sender_name || '-'}
                  </td>
                  <td className="py-2.5 px-3">
                    {tx.direction === 'income' ? 'ภาษีขาย (รายรับ)' : 'ภาษีซื้อ (รายจ่าย)'}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {tx.subtotal !== null ? formatTHB(tx.subtotal) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-brand tabular-nums">
                    {tx.vat_amount !== null ? formatTHB(tx.vat_amount) : '-'}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold tabular-nums">
                    {formatTHB(tx.total_amount)}
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
