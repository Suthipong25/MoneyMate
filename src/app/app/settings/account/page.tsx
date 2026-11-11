'use client';

import React, { useEffect, useState } from 'react';
import { UserCog, Trash2, ShieldAlert, Save } from 'lucide-react';
import type { UserProfile } from '@/types/domain';

export default function AccountSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [retentionDays, setRetentionDays] = useState<number>(365);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setFullName(d.user.full_name || '');
          setRetentionDays(d.user.data_retention_days || 365);
        }
      });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_profile',
        fullName,
        dataRetentionDays: retentionDays,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg('บันทึกการตั้งค่าบัญชีและนโยบายเก็บรักษาไฟล์เรียบร้อยแล้ว');
    } else {
      setMsg(data.error || 'ไม่สามารถบันทึกได้');
    }
  };

  const handlePurgeAllData = async () => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'purge_data' }),
    });
    const data = await res.json();
    setConfirmPurge(false);
    if (res.ok) {
      setMsg(data.message);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          ตั้งค่าบัญชีส่วนตัวและความปลอดภัยข้อมูล (Account & Privacy Settings)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          จัดการข้อมูลผู้ใช้งาน นโยบายอายุการจัดเก็บไฟล์สลิป และสิทธิ์การลบข้อมูลตามมาตรฐาน PDPA
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          {msg}
        </div>
      )}

      <form
        onSubmit={handleSaveProfile}
        className="mm-card-outer p-6 space-y-4 text-xs"
      >
        <div className="flex items-center gap-2 font-bold text-sm text-ink border-b border-border pb-3">
          <UserCog className="w-4 h-4 text-brand" />
          <span>ข้อมูลบัญชีผู้ใช้งาน</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="acc-email"
              className="block font-semibold text-ink mb-1"
            >
              อีเมลบัญชี (Email)
            </label>
            <input
              id="acc-email"
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-3.5 py-2 rounded-inner border border-border bg-surface-muted text-ink-muted"
            />
          </div>

          <div>
            <label
              htmlFor="acc-role"
              className="block font-semibold text-ink mb-1"
            >
              ระดับสิทธิ์ (Role — กำหนดโดย Server เท่านั้น)
            </label>
            <input
              id="acc-role"
              type="text"
              disabled
              value={user?.role || 'customer'}
              className="w-full px-3.5 py-2 rounded-inner border border-border bg-surface-muted text-ink-muted font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="acc-fullname"
              className="block font-semibold text-ink mb-1"
            >
              ชื่อ-นามสกุลผู้ใช้งาน
            </label>
            <input
              id="acc-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div>
            <label
              htmlFor="acc-retention"
              className="block font-semibold text-ink mb-1"
            >
              นโยบายเก็บรักษาไฟล์เอกสารต้นฉบับ (Data Retention Policy)
            </label>
            <select
              id="acc-retention"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-inner border border-border-strong bg-surface"
            >
              <option value={30}>เก็บไฟล์ 30 วัน แล้วลบอัตโนมัติ</option>
              <option value={90}>เก็บไฟล์ 90 วัน แล้วลบอัตโนมัติ</option>
              <option value={365}>เก็บไฟล์ 1 ปี (365 วัน)</option>
              <option value={1825}>เก็บไฟล์ 5 ปี ตามรอบบัญชีภาษี (1,825 วัน)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการตั้งค่าบัญชี</span>
          </button>
        </div>
      </form>

      {/* Danger Zone: Purge All Documents & Financial Transactions */}
      <div className="mm-card-outer p-6 border-expense/40 space-y-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-sm text-expense">
          <ShieldAlert className="w-4 h-4" />
          <span>การลบเอกสารและข้อมูลทางการเงินทั้งหมด (Data Purge & Privacy Control)</span>
        </div>
        <p className="text-ink-secondary leading-relaxed">
          คุณสามารถสั่งลบไฟล์รูปสลิป/ใบเสร็จทั้งหมดใน Private Storage และลบรายการธุรกรรมทั้งหมดของบัญชีคุณออกจากฐานข้อมูลได้ทันที (ยอดเครดิตคงเหลือในกระเป๋าจะไม่ถูกลบ)
        </p>

        {!confirmPurge ? (
          <button
            type="button"
            onClick={() => setConfirmPurge(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-expense border border-expense rounded-inner hover:bg-expense-soft"
          >
            <Trash2 className="w-4 h-4" />
            <span>ลบเอกสารและข้อมูลธุรกรรมทั้งหมดของฉัน</span>
          </button>
        ) : (
          <div className="p-4 rounded-inner bg-expense-soft border border-expense/30 space-y-3">
            <p className="font-bold text-expense">
              ยืนยันการลบข้อมูลทั้งหมดอย่างถาวร? การกระทำนี้ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePurgeAllData}
                className="px-4 py-2 font-semibold bg-expense text-white rounded-inner"
              >
                ยืนยันลบข้อมูลทั้งหมดทันที
              </button>
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                className="px-4 py-2 font-semibold bg-surface border border-border-strong rounded-inner"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
