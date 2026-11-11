'use client';

import React, { useEffect, useState } from 'react';
import { Package, Save } from 'lucide-react';
import type { CreditPackage } from '@/types/domain';
import { formatTHB } from '@/lib/utils/formatters';

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState<number>(100);
  const [priceThb, setPriceThb] = useState<number>(59);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const loadPackages = async () => {
    const res = await fetch('/api/admin');
    const data = await res.json();
    if (data.packages) setPackages(data.packages);
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_package',
        code,
        name,
        credits,
        price_thb: priceThb,
        is_active: isActive,
        reason,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      setReason('');
      await loadPackages();
    } else {
      setMsg(data.error);
    }
  };

  const selectForEdit = (pkg: CreditPackage) => {
    setCode(pkg.code);
    setName(pkg.name);
    setCredits(pkg.credits);
    setPriceThb(pkg.price_thb);
    setIsActive(pkg.is_active);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          จัดการแพ็กเกจเครดิตและราคา (Package Management)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          สร้างแพ็กเกจใหม่ แก้ไขราคา (THB) จำนวนเครดิต หรือเปิด/ปิดการจำหน่ายแพ็กเกจพร้อมบันทึก Audit Log
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleUpsert}
          className="lg:col-span-5 mm-card-outer p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-ink border-b border-border pb-3">
            <Package className="w-4 h-4 text-brand" />
            <span>สร้างหรือแก้ไขแพ็กเกจเครดิต</span>
          </div>

          <div>
            <label
              htmlFor="pkg-code"
              className="block font-semibold text-ink mb-1"
            >
              รหัสแพ็กเกจ (Code เช่น STARTER, BUSINESS, PRO)
            </label>
            <input
              id="pkg-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-inner border border-border-strong font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="pkg-name"
              className="block font-semibold text-ink mb-1"
            >
              ชื่อแสดงผลแพ็กเกจ
            </label>
            <input
              id="pkg-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="pkg-credits"
                className="block font-semibold text-ink mb-1"
              >
                จำนวนเครดิต (รูป)
              </label>
              <input
                id="pkg-credits"
                type="number"
                required
                min={1}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-inner border border-border-strong tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="pkg-price"
                className="block font-semibold text-ink mb-1"
              >
                ราคาขาย (บาท)
              </label>
              <input
                id="pkg-price"
                type="number"
                required
                min={0}
                step="0.01"
                value={priceThb}
                onChange={(e) => setPriceThb(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-inner border border-border-strong tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="pkg-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <label htmlFor="pkg-active" className="font-semibold text-ink">
              เปิดใช้งานแพ็กเกจนี้ให้ลูกค้าเลือกซื้อได้ (Enabled)
            </label>
          </div>

          <div>
            <label
              htmlFor="pkg-reason"
              className="block font-semibold text-ink mb-1"
            >
              เหตุผลในการสร้าง/แก้ไขแพ็กเกจ (Audit Reason)
            </label>
            <input
              id="pkg-reason"
              type="text"
              required
              minLength={5}
              placeholder="เช่น ปรับโปรโมชันประจำไตรมาส 4"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกข้อมูลแพ็กเกจ</span>
          </button>
        </form>

        <div className="lg:col-span-7 mm-card-outer p-5 space-y-4">
          <h2 className="text-sm font-bold text-ink">
            รายการแพ็กเกจทั้งหมดในระบบ (คลิกเพื่อดึงข้อมูลมาแก้ไข)
          </h2>
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="p-4 rounded-inner border border-border flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand">
                      {pkg.code}
                    </span>
                    <span className="font-semibold text-ink">{pkg.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pkg.is_active
                          ? 'bg-income-soft text-income'
                          : 'bg-surface-muted text-ink-muted'
                      }`}
                    >
                      {pkg.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-ink-secondary tabular-nums">
                    เครดิต: <strong>{pkg.credits}</strong> รูป · ราคา:{' '}
                    <strong>{formatTHB(pkg.price_thb)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectForEdit(pkg)}
                  className="px-3 py-1.5 font-semibold border border-border-strong rounded-inner hover:bg-surface-muted"
                >
                  แก้ไขแพ็กเกจนี้
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
