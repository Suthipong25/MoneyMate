'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import type { CategoryItem, TransactionRecord } from '@/types/domain';
import { formatTHB, formatThaiDate } from '@/lib/utils/formatters';

export default function TransactionsListPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await fetch('/api/transactions');
    const data = await res.json();
    if (data.transactions) setTransactions(data.transactions);
    if (data.categories) setCategories(data.categories);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = transactions.filter((tx) => {
      if (filterDirection !== 'all' && tx.direction !== filterDirection) {
        return false;
      }
      if (filterCategory !== 'all' && tx.category_name !== filterCategory) {
        return false;
      }
      if (filterStatus !== 'all' && tx.status !== filterStatus) {
        return false;
      }
      if (filterDateFrom && (tx.transaction_date || '') < filterDateFrom) {
        return false;
      }
      if (filterDateTo && (tx.transaction_date || '') > filterDateTo) {
        return false;
      }
      if (q) {
        const haystack = [
          tx.sender_name,
          tx.receiver_name,
          tx.merchant_name,
          tx.description,
          tx.reference_id,
          tx.category_name,
          tx.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'amount_desc') return b.total_amount - a.total_amount;
      if (sortBy === 'amount_asc') return a.total_amount - b.total_amount;
      const dA = `${a.transaction_date || ''}T${a.transaction_time || '00:00:00'}`;
      const dB = `${b.transaction_date || ''}T${b.transaction_time || '00:00:00'}`;
      return sortBy === 'date_asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
    });
  }, [
    transactions,
    searchQuery,
    filterDirection,
    filterCategory,
    filterStatus,
    filterDateFrom,
    filterDateTo,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginatedRows = filteredAndSorted.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/transactions?id=${encodeURIComponent(deleteTarget.id)}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    if (res.ok) {
      setTransactions((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setToastMsg(data.message || 'ลบรายการธุรกรรมเรียบร้อยแล้ว');
    }
    setDeleteTarget(null);
  };

  const quickConfirmReview = async (tx: TransactionRecord, chosenDirection: 'income' | 'expense') => {
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: tx.id,
        direction: chosenDirection,
        status: 'confirmed',
      }),
    });
    const data = await res.json();
    if (res.ok && data.transaction) {
      setTransactions((prev) =>
        prev.map((item) => (item.id === tx.id ? data.transaction : item))
      );
      setToastMsg('ยืนยันรายการเข้าสู่งบการเงินเรียบร้อยแล้ว');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            จัดการรายการธุรกรรม (Transactions Management)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            ค้นหา กรองตามวันที่ ประเภท หมวดหมู่ แก้ไขข้อมูลที่ AI สกัดมา หรือยืนยันรายการที่รอตรวจสอบ
          </p>
        </div>
        <a
          href="/api/export/excel"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-surface border border-border-strong rounded-inner hover:bg-surface-muted"
        >
          <FileSpreadsheet className="w-4 h-4 text-income" />
          <span>ดาวน์โหลด Excel (.xlsx 5 ชีต)</span>
        </a>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-inner bg-income-soft border border-income/30 text-xs font-medium text-income flex items-center justify-between">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-xs underline"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Search & Multi-Filter Bar */}
      <div className="mm-card-outer p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="ค้นหารายการธุรกรรม"
              placeholder="ค้นหาชื่อผู้โอน, ผู้รับ, ร้านค้า, Ref ID, หมายเหตุ..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-inner border border-border-strong"
            />
          </div>

          <select
            aria-label="กรองตามประเภท"
            value={filterDirection}
            onChange={(e) => {
              setFilterDirection(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-inner border border-border-strong bg-surface"
          >
            <option value="all">ทุกประเภทธุรกรรม</option>
            <option value="income">รายรับ (Income)</option>
            <option value="expense">รายจ่าย (Expense)</option>
            <option value="internal_transfer">โอนระหว่างบัญชีตัวเอง</option>
            <option value="needs_review">ระบุทิศทางไม่ได้ (Needs Review)</option>
          </select>

          <select
            aria-label="กรองตามหมวดหมู่"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-inner border border-border-strong bg-surface"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            aria-label="กรองตามสถานะ"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-inner border border-border-strong bg-surface"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="confirmed">ยืนยันแล้ว (Confirmed)</option>
            <option value="pending_review">รอตรวจสอบ (Pending Review)</option>
            <option value="duplicate">รายการซ้ำ (Duplicate)</option>
            <option value="failed">ล้มเหลว (Failed)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-secondary">ช่วงวันที่:</span>
            <input
              type="date"
              aria-label="ตั้งแต่วันที่"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-2.5 py-1 rounded-inner border border-border-strong"
            />
            <span className="text-ink-muted">ถึง</span>
            <input
              type="date"
              aria-label="ถึงวันที่"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-2.5 py-1 rounded-inner border border-border-strong"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ink-secondary">เรียงตาม:</span>
            <select
              aria-label="เรียงลำดับ"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-2.5 py-1 rounded-inner border border-border-strong bg-surface"
            >
              <option value="date_desc">วันที่ล่าสุดก่อน</option>
              <option value="date_asc">วันที่เก่าสุดก่อน</option>
              <option value="amount_desc">จำนวนเงินมาก → น้อย</option>
              <option value="amount_asc">จำนวนเงินน้อย → มาก</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">วันที่ / เวลา</th>
                <th className="py-3 px-3 font-semibold">ประเภท</th>
                <th className="py-3 px-3 font-semibold">ผู้โอน → ผู้รับ / รายละเอียด</th>
                <th className="py-3 px-3 font-semibold">ธนาคาร / Ref ID</th>
                <th className="py-3 px-3 font-semibold">หมวดหมู่</th>
                <th className="py-3 px-3 font-semibold">สถานะ</th>
                <th className="py-3 px-3 font-semibold text-right">จำนวนเงิน</th>
                <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-muted">
                    กำลังโหลดรายการธุรกรรม...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-muted">
                    ไม่พบรายการธุรกรรมที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedRows.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-muted/50">
                    <td className="py-3 px-4 tabular-nums">
                      <p className="font-semibold text-ink">
                        {formatThaiDate(tx.transaction_date)}
                      </p>
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
                          รอระบุประเภท
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <p className="font-semibold text-ink truncate">
                        {tx.sender_name || '-'} →{' '}
                        {tx.receiver_name || tx.merchant_name || '-'}
                      </p>
                      <p className="text-ink-muted truncate">
                        {tx.description || tx.notes || '-'}
                      </p>
                      {tx.review_reason && (
                        <p className="text-[11px] text-warning mt-0.5">
                          เหตุผลตรวจสอบ: {tx.review_reason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-ink">
                        {[tx.sender_bank, tx.receiver_bank]
                          .filter(Boolean)
                          .join(' → ') || '-'}
                      </p>
                      <p className="font-mono text-[11px] text-ink-muted">
                        Ref: {tx.reference_id || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-medium text-ink-secondary">
                      {tx.category_name}
                    </td>
                    <td className="py-3 px-3">
                      {tx.status === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 text-income font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ยืนยันแล้ว
                        </span>
                      )}
                      {tx.status === 'pending_review' && (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-warning font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            รอตรวจสอบ
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => quickConfirmReview(tx, 'income')}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-income text-white rounded"
                            >
                              ยืนยันเป็นรายรับ
                            </button>
                            <button
                              type="button"
                              onClick={() => quickConfirmReview(tx, 'expense')}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-expense text-white rounded"
                            >
                              ยืนยันเป็นรายจ่าย
                            </button>
                          </div>
                        </div>
                      )}
                      {tx.status === 'duplicate' && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-warning font-semibold">
                            <Copy className="w-3.5 h-3.5" />
                            รายการซ้ำ
                          </span>
                          {tx.duplicate_of_id && (
                            <Link
                              href={`/app/transactions/${tx.duplicate_of_id}`}
                              className="block text-[10px] text-brand underline"
                            >
                              ดูรายการต้นฉบับ
                            </Link>
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold tabular-nums ${
                        tx.status === 'duplicate'
                          ? 'line-through text-ink-muted'
                          : tx.direction === 'income'
                            ? 'text-income'
                            : tx.direction === 'expense'
                              ? 'text-expense'
                              : 'text-ink'
                      }`}
                    >
                      {formatTHB(tx.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/app/transactions/${tx.id}`}
                          aria-label={`แก้ไขรายการ ${tx.id}`}
                          className="p-1.5 rounded-inner border border-border hover:bg-surface-muted text-ink-secondary hover:text-brand"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          aria-label={`ลบรายการ ${tx.id}`}
                          onClick={() => setDeleteTarget(tx)}
                          className="p-1.5 rounded-inner border border-border hover:bg-expense-soft text-ink-secondary hover:text-expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-surface-muted border-t border-border flex items-center justify-between text-xs">
          <span className="text-ink-secondary tabular-nums">
            แสดง {paginatedRows.length} จากทั้งหมด {filteredAndSorted.length} รายการ
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-inner border border-border bg-surface disabled:opacity-40"
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold tabular-nums">
              หน้า {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-inner border border-border bg-surface disabled:opacity-40"
              aria-label="หน้าถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full mm-card-outer p-6 space-y-4">
            <h2 className="text-base font-bold text-ink">
              ยืนยันการลบรายการธุรกรรม
            </h2>
            <p className="text-xs text-ink-secondary leading-relaxed">
              คุณต้องการลบรายการ <strong>{deleteTarget.description || deleteTarget.receiver_name}</strong>{' '}
              ยอดเงิน <strong className="tabular-nums">{formatTHB(deleteTarget.total_amount)}</strong> ใช่หรือไม่?
              (การลบรายการจะไม่ทำให้ประวัติเครดิตในกระเป๋าคลาดเคลื่อน)
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold border border-border-strong rounded-inner"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-expense text-white rounded-inner"
              >
                ยืนยันลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
