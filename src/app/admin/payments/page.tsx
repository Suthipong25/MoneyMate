'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle2, Clock } from 'lucide-react';
import type { PaymentOrder } from '@/types/domain';
import { formatTHB, formatThaiDate } from '@/lib/utils/formatters';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [refundTarget, setRefundTarget] = useState<PaymentOrder | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const loadPayments = async () => {
    const res = await fetch('/api/admin');
    const data = await res.json();
    if (data.payments) setPayments(data.payments);
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refund_payment',
        orderId: refundTarget.id,
        reason,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      setRefundTarget(null);
      setReason('');
      await loadPayments();
    } else {
      setMsg(data.error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          จัดการรายการชำระเงิน (Payment Management)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          ตรวจสอบ Payment Reference สถานะการชำระเงิน และการบันทึกสถานะคืนเงิน (Refund) พร้อม Audit Log
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          {msg}
        </div>
      )}

      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">วัน-เวลา</th>
                <th className="py-3 px-3 font-semibold">Payment Reference</th>
                <th className="py-3 px-3 font-semibold">แพ็กเกจ / เครดิต</th>
                <th className="py-3 px-3 font-semibold">Gateway</th>
                <th className="py-3 px-3 font-semibold">สถานะ</th>
                <th className="py-3 px-3 font-semibold text-right">ยอดเงิน (฿)</th>
                <th className="py-3 px-4 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((ord) => (
                <tr key={ord.id}>
                  <td className="py-3 px-4 tabular-nums">
                    {formatThaiDate(ord.created_at)}
                  </td>
                  <td className="py-3 px-3 font-mono font-medium">
                    {ord.provider_reference}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-brand">
                      {ord.package_code}
                    </span>{' '}
                    (+{ord.credits_amount} เครดิต)
                  </td>
                  <td className="py-3 px-3 uppercase">{ord.provider}</td>
                  <td className="py-3 px-3">
                    {ord.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 text-income font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Paid
                      </span>
                    )}
                    {ord.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-warning font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                      </span>
                    )}
                    {ord.status === 'refunded' && (
                      <div>
                        <span className="inline-flex items-center gap-1 text-expense font-semibold">
                          <RotateCcw className="w-3.5 h-3.5" />
                          Refunded
                        </span>
                        {ord.refund_reason && (
                          <p className="text-[11px] text-ink-muted">
                            เหตุผล: {ord.refund_reason}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums">
                    {formatTHB(ord.amount_thb)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {ord.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRefundTarget(ord);
                          setReason('');
                        }}
                        className="px-2.5 py-1 rounded-inner bg-expense-soft text-expense font-semibold"
                      >
                        บันทึก Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {refundTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleRefundSubmit}
            className="max-w-md w-full mm-card-outer p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-ink">
              ยืนยันการบันทึกสถานะคืนเงิน (Refund)
            </h2>
            <p className="text-ink-secondary">
              รายการ: <strong>{refundTarget.provider_reference}</strong> ยอดเงิน{' '}
              <strong className="tabular-nums">
                {formatTHB(refundTarget.amount_thb)}
              </strong>
            </p>
            <div>
              <label
                htmlFor="refund-reason"
                className="block font-semibold text-ink mb-1"
              >
                เหตุผลในการคืนเงิน (บังคับระบุเพื่อบันทึกใน Audit Log)
              </label>
              <textarea
                id="refund-reason"
                required
                minLength={5}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-inner border border-border-strong"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2 font-semibold border border-border-strong rounded-inner"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-semibold bg-expense text-white rounded-inner"
              >
                ยืนยันบันทึก Refund
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
