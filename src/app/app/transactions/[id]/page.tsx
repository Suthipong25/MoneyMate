'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Lock,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import type {
  CategoryItem,
  DocumentRecord,
  TransactionRecord,
} from '@/types/domain';
import { formatTHB } from '@/lib/utils/formatters';

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const txId = params.id;

  const [tx, setTx] = useState<TransactionRecord | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/transactions?id=${encodeURIComponent(txId)}`).then((r) =>
        r.json()
      ),
      fetch('/api/transactions').then((r) => r.json()),
    ]).then(([detailData, listData]) => {
      if (detailData.transaction) setTx(detailData.transaction);
      if (detailData.document) setDoc(detailData.document);
      if (detailData.signedDocumentUrl)
        setSignedUrl(detailData.signedDocumentUrl);
      if (listData.categories) setCategories(listData.categories);
    });
  }, [txId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tx) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: tx.id,
        transaction_date: tx.transaction_date,
        transaction_time: tx.transaction_time,
        direction: tx.direction,
        category_name: tx.category_name,
        sender_name: tx.sender_name,
        receiver_name: tx.receiver_name,
        merchant_name: tx.merchant_name,
        sender_bank: tx.sender_bank,
        receiver_bank: tx.receiver_bank,
        subtotal: tx.subtotal !== null ? Number(tx.subtotal) : null,
        vat_amount: tx.vat_amount !== null ? Number(tx.vat_amount) : null,
        total_amount: Number(tx.total_amount),
        reference_id: tx.reference_id,
        status: tx.status,
        notes: tx.notes,
        description: tx.description,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok && data.transaction) {
      setTx(data.transaction);
      setMessage('บันทึกการแก้ไขข้อมูลและอัปเดตงบการเงินเรียบร้อยแล้ว');
    } else {
      setMessage(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  if (!tx) {
    return (
      <div className="mm-card-outer p-8 text-center text-xs text-ink-muted">
        กำลังโหลดรายละเอียดธุรกรรม...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/app/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปหน้ารายการธุรกรรมทั้งหมด</span>
        </Link>
        <span className="text-xs font-mono text-ink-muted">ID: {tx.id}</span>
      </div>

      {message && (
        <div className="p-3.5 rounded-inner bg-income-soft border border-income/30 text-xs font-semibold text-income">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Original Document Viewer via Private Storage Signed URL */}
        <div className="lg:col-span-5 mm-card-outer p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-bold text-ink">
                ภาพเอกสารต้นฉบับ (Original Document)
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-income font-medium">
              <Lock className="w-3 h-3" />
              Signed URL
            </span>
          </div>

          <div className="p-4 rounded-inner bg-surface-muted border border-border space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">ประเภทเอกสารที่ตรวจพบ:</span>
              <span className="font-semibold text-ink">{tx.document_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">ความมั่นใจของ AI (Confidence):</span>
              <span className="font-bold text-brand tabular-nums">
                {(tx.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">สถานะภาษีมูลค่าเพิ่ม (VAT):</span>
              <span className="font-semibold text-ink">{tx.vat_status}</span>
            </div>
            {doc && (
              <div className="pt-2 border-t border-border space-y-1 text-[11px] text-ink-muted">
                <p>ชื่อไฟล์: {doc.file_name}</p>
                <p className="font-mono break-all">
                  SHA-256: {doc.file_hash_sha256}
                </p>
                {signedUrl && (
                  <p className="font-mono text-brand truncate">
                    Private Storage Path: {doc.storage_path}
                  </p>
                )}
              </div>
            )}
          </div>

          {tx.review_reason && (
            <div className="p-3.5 rounded-inner bg-warning-soft border border-warning/30 text-xs text-warning flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">สาเหตุที่ส่งตรวจสอบ (Review Reason):</p>
                <p>{tx.review_reason}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Editable AI Extracted Fields Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 mm-card-outer p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-ink border-b border-border pb-3">
            ตรวจสอบและแก้ไขข้อมูลที่ AI สกัดได้
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label
                htmlFor="tx-direction"
                className="block font-semibold text-ink mb-1"
              >
                ประเภทธุรกรรม (Direction)
              </label>
              <select
                id="tx-direction"
                value={tx.direction}
                onChange={(e) =>
                  setTx({
                    ...tx,
                    direction: e.target.value as TransactionRecord['direction'],
                  })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong bg-surface font-semibold"
              >
                <option value="income">รายรับ (Income)</option>
                <option value="expense">รายจ่าย (Expense)</option>
                <option value="internal_transfer">
                  โอนระหว่างบัญชีตัวเอง (Internal Transfer)
                </option>
                <option value="needs_review">รอตรวจสอบ (Needs Review)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="tx-status"
                className="block font-semibold text-ink mb-1"
              >
                สถานะการยืนยัน (Status)
              </label>
              <select
                id="tx-status"
                value={tx.status}
                onChange={(e) =>
                  setTx({
                    ...tx,
                    status: e.target.value as TransactionRecord['status'],
                  })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong bg-surface font-semibold"
              >
                <option value="confirmed">
                  ยืนยันแล้ว (Confirmed — นำไปคำนวณในแดชบอร์ด)
                </option>
                <option value="pending_review">
                  รอตรวจสอบ (Pending Review)
                </option>
                <option value="duplicate">รายการซ้ำ (Duplicate)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="tx-date"
                className="block font-semibold text-ink mb-1"
              >
                วันที่ทำรายการ (ISO Date)
              </label>
              <input
                id="tx-date"
                type="date"
                value={tx.transaction_date || ''}
                onChange={(e) =>
                  setTx({ ...tx, transaction_date: e.target.value })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="tx-time"
                className="block font-semibold text-ink mb-1"
              >
                เวลา
              </label>
              <input
                id="tx-time"
                type="text"
                value={tx.transaction_time || ''}
                onChange={(e) =>
                  setTx({ ...tx, transaction_time: e.target.value })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="tx-category"
                className="block font-semibold text-ink mb-1"
              >
                หมวดหมู่ (Category)
              </label>
              <select
                id="tx-category"
                value={tx.category_name}
                onChange={(e) =>
                  setTx({ ...tx, category_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong bg-surface"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.direction === 'income' ? 'รายรับ' : 'รายจ่าย'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tx-ref"
                className="block font-semibold text-ink mb-1"
              >
                รหัสอ้างอิงสลิป / เลขที่ใบกำกับภาษี (Reference ID)
              </label>
              <input
                id="tx-ref"
                type="text"
                value={tx.reference_id || ''}
                onChange={(e) =>
                  setTx({ ...tx, reference_id: e.target.value || null })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="tx-sender"
                className="block font-semibold text-ink mb-1"
              >
                ชื่อผู้โอน (Sender Name)
              </label>
              <input
                id="tx-sender"
                type="text"
                value={tx.sender_name || ''}
                onChange={(e) =>
                  setTx({ ...tx, sender_name: e.target.value || null })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong"
              />
            </div>

            <div>
              <label
                htmlFor="tx-receiver"
                className="block font-semibold text-ink mb-1"
              >
                ชื่อผู้รับ / ร้านค้า (Receiver / Merchant)
              </label>
              <input
                id="tx-receiver"
                type="text"
                value={tx.receiver_name || tx.merchant_name || ''}
                onChange={(e) =>
                  setTx({ ...tx, receiver_name: e.target.value || null })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong"
              />
            </div>

            <div>
              <label
                htmlFor="tx-subtotal"
                className="block font-semibold text-ink mb-1"
              >
                ยอดก่อนภาษี (Subtotal — เว้นว่างหากไม่มี VAT)
              </label>
              <input
                id="tx-subtotal"
                type="number"
                step="0.01"
                value={tx.subtotal ?? ''}
                onChange={(e) =>
                  setTx({
                    ...tx,
                    subtotal:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="tx-vat"
                className="block font-semibold text-ink mb-1"
              >
                ยอดภาษีมูลค่าเพิ่ม (VAT Amount)
              </label>
              <input
                id="tx-vat"
                type="number"
                step="0.01"
                value={tx.vat_amount ?? ''}
                onChange={(e) =>
                  setTx({
                    ...tx,
                    vat_amount:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="tx-total"
                className="block font-semibold text-ink mb-1"
              >
                จำนวนเงินสุทธิ (Total Amount — บาท): {formatTHB(tx.total_amount)}
              </label>
              <input
                id="tx-total"
                type="number"
                step="0.01"
                required
                value={tx.total_amount}
                onChange={(e) =>
                  setTx({ ...tx, total_amount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-inner border border-border-strong text-sm font-bold tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="tx-notes"
                className="block font-semibold text-ink mb-1"
              >
                รายละเอียด / หมายเหตุเพิ่มเติม (Notes)
              </label>
              <textarea
                id="tx-notes"
                rows={2}
                value={tx.notes || tx.description || ''}
                onChange={(e) => setTx({ ...tx, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-inner border border-border-strong"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => router.push('/app/transactions')}
              className="px-4 py-2 text-xs font-semibold border border-border-strong rounded-inner"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
