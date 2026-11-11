'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import type { BusinessAccount } from '@/types/domain';

export default function BusinessSettingsPage() {
  const [biz, setBiz] = useState<BusinessAccount | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((d) => {
        if (d.business) {
          setBiz(d.business);
          setAliasesText((d.business.account_aliases || []).join(', '));
        }
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biz) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_business',
        owner_name: biz.owner_name,
        business_name: biz.business_name,
        bank_name: biz.bank_name,
        account_number: biz.account_number,
        account_aliases: aliasesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        currency: biz.currency,
        default_income_category: biz.default_income_category,
        default_expense_category: biz.default_expense_category,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok && data.business) {
      setBiz(data.business);
      setMsg(data.message);
    }
  };

  if (!biz) {
    return <div className="p-6 text-xs">กำลังโหลดการตั้งค่าธุรกิจ...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          ตั้งค่าโปรไฟล์ธุรกิจและบัญชีธนาคาร (Business Settings)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          ข้อมูลนี้ใช้เป็นสมองหลักในการจำแนกว่าสลิปใบไหนเป็น &ldquo;รายรับ&rdquo;, &ldquo;รายจ่าย&rdquo; หรือ &ldquo;โอนระหว่างบัญชีตัวเอง&rdquo; โดยอัตโนมัติ
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-inner bg-income-soft border border-income/30 text-xs font-semibold text-income">
          {msg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="mm-card-outer p-6 space-y-4 text-xs"
      >
        <div className="flex items-center gap-2 font-bold text-sm text-ink border-b border-border pb-3">
          <Building2 className="w-4 h-4 text-brand" />
          <span>ข้อมูลเจ้าของร้านและบัญชีรับ-จ่ายเงิน</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="biz-owner"
              className="block font-semibold text-ink mb-1"
            >
              ชื่อเจ้าของร้าน / ชื่อบัญชีหลัก
            </label>
            <input
              id="biz-owner"
              type="text"
              required
              value={biz.owner_name}
              onChange={(e) => setBiz({ ...biz, owner_name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div>
            <label
              htmlFor="biz-name"
              className="block font-semibold text-ink mb-1"
            >
              ชื่อธุรกิจ / ชื่อร้านค้า
            </label>
            <input
              id="biz-name"
              type="text"
              required
              value={biz.business_name}
              onChange={(e) =>
                setBiz({ ...biz, business_name: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div>
            <label
              htmlFor="biz-bank"
              className="block font-semibold text-ink mb-1"
            >
              ธนาคารหลักที่ใช้รับ-โอนเงิน
            </label>
            <input
              id="biz-bank"
              type="text"
              value={biz.bank_name}
              onChange={(e) => setBiz({ ...biz, bank_name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div>
            <label
              htmlFor="biz-accno"
              className="block font-semibold text-ink mb-1"
            >
              เลขบัญชีหรือเลขท้าย 4 หลัก (เช่น xxx-x-xx889-1)
            </label>
            <input
              id="biz-accno"
              type="text"
              value={biz.account_number}
              onChange={(e) =>
                setBiz({ ...biz, account_number: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="biz-aliases"
              className="block font-semibold text-ink mb-1"
            >
              Alias ชื่อบัญชีอื่นๆ ที่อาจปรากฏในสลิป (คั่นด้วยเครื่องหมายจุลภาค ,)
            </label>
            <input
              id="biz-aliases"
              type="text"
              placeholder="เช่น มณีเมท, MoneyMate Studio, นายสมชาย ใจดี, SOMCHAI J"
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              ใส่ทั้งชื่อภาษาไทย ภาษาอังกฤษ หรือชื่อย่อที่ธนาคารมักแสดงบนสลิป เพื่อให้ AI แยก รายรับ-รายจ่าย แม่นยำ 100%
            </p>
          </div>

          <div>
            <label
              htmlFor="biz-inc-cat"
              className="block font-semibold text-ink mb-1"
            >
              หมวดหมู่รายรับเริ่มต้น
            </label>
            <input
              id="biz-inc-cat"
              type="text"
              value={biz.default_income_category}
              onChange={(e) =>
                setBiz({ ...biz, default_income_category: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div>
            <label
              htmlFor="biz-exp-cat"
              className="block font-semibold text-ink mb-1"
            >
              หมวดหมู่รายจ่ายเริ่มต้น
            </label>
            <input
              id="biz-exp-cat"
              type="text"
              value={biz.default_expense_category}
              onChange={(e) =>
                setBiz({ ...biz, default_expense_category: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าธุรกิจ'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
