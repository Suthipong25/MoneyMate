'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calculator, UploadCloud, ArrowLeft } from 'lucide-react';
import { formatTHB } from '@/lib/utils/formatters';

export default function VatCalculatorToolPage() {
  const [amount, setAmount] = useState<string>('10700');
  const [mode, setMode] = useState<'extract' | 'add'>('extract');

  const num = Math.max(0, Number(amount) || 0);
  const subtotal =
    mode === 'extract'
      ? Number(((num * 100) / 107).toFixed(2))
      : Number(num.toFixed(2));
  const vat =
    mode === 'extract'
      ? Number((num - subtotal).toFixed(2))
      : Number((num * 0.07).toFixed(2));
  const total =
    mode === 'extract'
      ? Number(num.toFixed(2))
      : Number((subtotal + vat).toFixed(2));

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้าแรก MoneyMate</span>
          </Link>
          <Link href="/">
            <Image
              src="/brand/logo-header.png?v=3"
              alt="MoneyMate"
              width={130}
              height={34}
              className="h-7 w-auto object-contain"
            />
          </Link>
        </div>

        <div className="mm-card-outer p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/sticker-plan.png"
              alt="วางแผนการเงินและคำนวณภาษี"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
            />
            <div className="flex items-center gap-2 text-brand text-sm font-semibold">
              <Calculator className="w-4 h-4" />
              <span>เครื่องมือบัญชีออนไลน์ฟรีโดย MoneyMate</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-ink">
            โปรแกรมคำนวณและถอดภาษีมูลค่าเพิ่ม VAT 7% อัตโนมัติ
          </h1>
          <p className="text-sm text-ink-secondary">
            ใช้คำนวณถอดยอดก่อนภาษี (Subtotal) และภาษีมูลค่าเพิ่ม 7% จากใบเสร็จรับเงินหรือใบกำกับภาษีอย่างแม่นยำ
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="vat-tool-amount"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                ระบุจำนวนเงิน (บาท)
              </label>
              <input
                id="vat-tool-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-inner border border-border-strong text-base font-bold tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="vat-tool-mode"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                โหมดการคำนวณ
              </label>
              <select
                id="vat-tool-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'extract' | 'add')}
                className="w-full px-4 py-2.5 rounded-inner border border-border-strong text-sm bg-surface"
              >
                <option value="extract">ราคารวม VAT แล้ว (ต้องการถอด VAT 7%)</option>
                <option value="add">ราคายังไม่รวม VAT (ต้องการบวก VAT 7%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-inner bg-surface-muted border border-border">
            <div>
              <p className="text-xs text-ink-muted">มูลค่าสินค้า/บริการก่อน VAT</p>
              <p className="text-xl font-bold text-ink tabular-nums mt-1">
                {formatTHB(subtotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">ภาษีมูลค่าเพิ่ม (VAT 7%)</p>
              <p className="text-xl font-bold text-brand tabular-nums mt-1">
                {formatTHB(vat)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">จำนวนเงินรวมทั้งสิ้น</p>
              <p className="text-xl font-bold text-income tabular-nums mt-1">
                {formatTHB(total)}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-inner bg-brand-soft border border-brand/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-ink">
                ขี้เกียจมานั่งกดเครื่องคิดเลขทีละบิลใช่ไหม?
              </p>
              <p className="text-xs text-ink-secondary">
                โยนรูปใบกำกับภาษีและสลิปธนาคารสูงสุด 100 ใบให้ AI ของ MoneyMate ถอด VAT 7% ลงตาราง Excel 5 ชีตให้ในคลิกเดียว!
              </p>
            </div>
            <Link
              href="/app/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner shrink-0 mm-interactive"
            >
              <UploadCloud className="w-4 h-4" />
              <span>ทดลองสแกนบิลฟรี 5 รูป</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
