'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, RotateCcw, QrCode } from 'lucide-react';
import type { PaymentOrder } from '@/types/domain';
import { formatTHB, formatThaiDate } from '@/lib/utils/formatters';

export default function PaymentHistoryPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);

  useEffect(() => {
    fetch('/api/payments/create-qr')
      .then((r) => r.json())
      .then((d) => {
        if (d.orders) setOrders(d.orders);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            ประวัติการสั่งซื้อและชำระเงิน (Payment History)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            ตรวจสอบสถานะคำสั่งซื้อเครดิต (Pending / Paid / Failed / Refunded) และรหัสอ้างอิง PromptPay
          </p>
        </div>
        <Link
          href="/app/checkout"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
        >
          <QrCode className="w-4 h-4" />
          <span>ซื้อแพ็กเกจเครดิตเพิ่ม</span>
        </Link>
      </div>

      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">วันที่สร้างคำสั่งซื้อ</th>
                <th className="py-3 px-3 font-semibold">Payment Reference</th>
                <th className="py-3 px-3 font-semibold">แพ็กเกจ</th>
                <th className="py-3 px-3 font-semibold">จำนวนเครดิต</th>
                <th className="py-3 px-3 font-semibold">ช่องทาง</th>
                <th className="py-3 px-3 font-semibold">สถานะ</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดชำระ (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    ยังไม่มีประวัติคำสั่งซื้อ
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-surface-muted/50">
                    <td className="py-3 px-4 tabular-nums">
                      {formatThaiDate(ord.created_at)}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-ink">
                      {ord.provider_reference}
                    </td>
                    <td className="py-3 px-3 font-semibold text-brand">
                      {ord.package_code}
                    </td>
                    <td className="py-3 px-3 tabular-nums font-semibold">
                      +{ord.credits_amount} เครดิต
                    </td>
                    <td className="py-3 px-3 uppercase text-ink-secondary">
                      {ord.provider}
                    </td>
                    <td className="py-3 px-3">
                      {ord.status === 'paid' && (
                        <span className="inline-flex items-center gap-1 text-income font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ชำระสำเร็จ (Paid)
                        </span>
                      )}
                      {ord.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-warning font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          รอชำระเงิน (Pending)
                        </span>
                      )}
                      {ord.status === 'refunded' && (
                        <span className="inline-flex items-center gap-1 text-ink-muted font-semibold">
                          <RotateCcw className="w-3.5 h-3.5" />
                          คืนเงินแล้ว (Refunded)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums">
                      {formatTHB(ord.amount_thb)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
