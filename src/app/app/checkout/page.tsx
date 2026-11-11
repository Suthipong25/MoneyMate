'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Lock,
} from 'lucide-react';
import type { CreditPackage, PaymentOrder } from '@/types/domain';
import { formatTHB } from '@/lib/utils/formatters';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPkg = searchParams.get('package') || 'STARTER';

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>(initialPkg);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [isSandbox, setIsSandbox] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/payments/create-qr')
      .then((r) => r.json())
      .then((d) => {
        if (d.packages) {
          const paidPkgs = (d.packages as CreditPackage[]).filter(
            (p) => p.price_thb > 0
          );
          setPackages(paidPkgs);
        }
      });
  }, []);

  const createQrOrder = async () => {
    setLoading(true);
    setStatusMessage(null);
    const res = await fetch('/api/payments/create-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageCode: selectedCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok && data.order) {
      setOrder(data.order);
      setIsSandbox(Boolean(data.isSandbox));
    } else {
      setStatusMessage(data.error || 'ไม่สามารถสร้าง QR Code ได้');
    }
  };

  const triggerSandboxSignedWebhook = async () => {
    if (!order) return;
    setLoading(true);
    const res = await fetch('/api/payments/create-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trigger_sandbox_webhook',
        orderId: order.id,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok && data.order) {
      setOrder(data.order);
      setStatusMessage(data.message);
    } else {
      setStatusMessage(data.error || 'เกิดข้อผิดพลาดในการตรวจสอบ Webhook');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          ชำระเงินเติมเครดิตด้วย QR PromptPay (Payment Checkout)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          รองรับ GB Prime Pay / Opn Payments — เติมเครดิตอัตโนมัติผ่าน Verified Webhook Signature เท่านั้น (ไม่รับเติมเครดิตจากการอัปโหลดรูปสลิปเอง)
        </p>
      </div>

      {/* Step 1: Select Package */}
      <div className="mm-card-outer p-6 space-y-4">
        <h2 className="text-sm font-bold text-ink">
          1. เลือกแพ็กเกจเครดิตที่ต้องการเติม
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => {
                setSelectedCode(pkg.code);
                setOrder(null);
                setStatusMessage(null);
              }}
              className={`p-4 rounded-inner border text-left space-y-1 mm-interactive ${
                selectedCode === pkg.code
                  ? 'border-brand bg-brand-soft/60 ring-2 ring-brand/20'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand">{pkg.code}</span>
                <span className="text-xs font-semibold tabular-nums">
                  {pkg.credits} เครดิต
                </span>
              </div>
              <p className="text-base font-bold text-ink">{pkg.name}</p>
              <p className="text-xl font-bold text-ink tabular-nums">
                {formatTHB(pkg.price_thb)}
              </p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={createQrOrder}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
        >
          <QrCode className="w-4 h-4" />
          <span>สร้าง Dynamic PromptPay QR สำหรับแพ็กเกจ {selectedCode}</span>
        </button>
      </div>

      {/* Step 2: Dynamic QR Display & Verified Webhook Fulfillment */}
      {order && (
        <div className="mm-card-outer p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">
                2. สแกน QR PromptPay เพื่อชำระเงิน
              </h2>
              <p className="text-xs text-ink-muted font-mono">
                Payment Reference: {order.provider_reference}
              </p>
            </div>
            {isSandbox && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-inner bg-warning-soft text-warning border border-warning/30">
                SANDBOX / MOCK ADAPTER MODE
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Simulated PromptPay QR Card */}
            <div className="md:col-span-5 p-5 rounded-inner border-2 border-brand bg-surface text-center space-y-3">
              <div className="py-1.5 px-3 bg-brand text-white text-xs font-bold rounded-inner">
                THAI QR PROMPTPAY
              </div>
              <div className="w-40 h-40 mx-auto rounded-inner bg-surface-muted border border-border flex flex-col items-center justify-center p-3">
                <QrCode className="w-24 h-24 text-ink" />
                <span className="text-[10px] font-mono text-ink-muted truncate max-w-full mt-1">
                  {order.provider_reference}
                </span>
              </div>
              <p className="text-lg font-bold text-ink tabular-nums">
                ยอดชำระ: {formatTHB(order.amount_thb)}
              </p>
              <p className="text-[11px] text-ink-muted">
                จะได้รับ +{order.credits_amount} เครดิตทันทีเมื่อ Gateway ส่ง Webhook ยืนยัน
              </p>
            </div>

            {/* Status & Sandbox Webhook Trigger */}
            <div className="md:col-span-7 space-y-4 text-xs">
              <div className="p-4 rounded-inner bg-surface-muted space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink-muted">สถานะคำสั่งซื้อ:</span>
                  <span
                    className={`font-bold uppercase ${
                      order.status === 'paid' ? 'text-income' : 'text-warning'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">ผู้ให้บริการ (Adapter):</span>
                  <span className="font-semibold text-ink">
                    {order.provider.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">EMVCo Payload:</span>
                  <span className="font-mono text-[11px] text-ink-secondary truncate max-w-[220px]">
                    {order.qr_payload}
                  </span>
                </div>
              </div>

              {statusMessage && (
                <div className="p-3.5 rounded-inner bg-income-soft border border-income/30 text-income font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {isSandbox && (
                <div className="p-4 rounded-inner bg-brand-soft border border-brand/20 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-brand">
                    <Zap className="w-4 h-4" />
                    <span>โหมดทดสอบสำหรับนักพัฒนา (Sandbox Webhook Simulator)</span>
                  </div>
                  <p className="text-ink-secondary leading-relaxed">
                    เนื่องจากยังไม่ได้ตั้งค่า Production Secret Key ของ GB Prime Pay / Opn ระบบจึงทำงานในโหมด Sandbox คุณสามารถกดปุ่มด้านล่างเพื่อยิง{' '}
                    <strong>HMAC-SHA256 Signed Webhook</strong> เข้าสู่ Server เพื่อทดสอบการเติมเครดิตและการป้องกัน Webhook ซ้ำ (Idempotency) ได้ทันที
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={triggerSandboxSignedWebhook}
                      className="px-4 py-2 font-semibold text-white bg-income hover:opacity-95 rounded-inner"
                    >
                      {order.status === 'paid'
                        ? 'ทดสอบยิง Webhook ซ้ำ (ต้องไม่บวกเครดิตซ้ำ)'
                        : 'จำลองการชำระเงินสำเร็จ (Send Signed Webhook)'}
                    </button>
                    {order.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => router.push('/app/credits')}
                        className="px-4 py-2 font-semibold bg-surface border border-border-strong rounded-inner"
                      >
                        ไปดูยอดเครดิตในกระเป๋า
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-ink-muted pt-1">
                <Lock className="w-3.5 h-3.5 text-income" />
                <span>
                  ตรวจสอบลายเซ็น HMAC-SHA256, ยอดเงิน และ Payment Reference ฝั่ง Server ทุกครั้ง
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentCheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs">กำลังโหลดหน้าชำระเงิน...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
