'use client';

import React, { useEffect, useState } from 'react';
import { Tags, Save } from 'lucide-react';
import type { CategoryItem } from '@/types/domain';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'income' | 'expense'>('expense');
  const [isActive, setIsActive] = useState(true);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const loadCategories = async () => {
    const res = await fetch('/api/admin');
    const data = await res.json();
    if (data.categories) setCategories(data.categories);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_default_category',
        name,
        direction,
        is_active: isActive,
        reason,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      setName('');
      setReason('');
      await loadCategories();
    } else {
      setMsg(data.error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          จัดการหมวดหมู่เริ่มต้นของระบบ (Default Category Management)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          สร้าง แก้ไข หรือเปิด/ปิดหมวดหมู่มาตรฐานกลางที่ใช้เป็นตัวเลือกเริ่มต้นสำหรับ AI และผู้ใช้ทุกคน
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
            <Tags className="w-4 h-4 text-brand" />
            <span>เพิ่มหรือแก้ไขหมวดหมู่กลาง</span>
          </div>

          <div>
            <label
              htmlFor="admin-cat-name"
              className="block font-semibold text-ink mb-1"
            >
              ชื่อหมวดหมู่มาตรฐาน
            </label>
            <input
              id="admin-cat-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-inner border border-border-strong"
            />
          </div>

          <div>
            <label
              htmlFor="admin-cat-dir"
              className="block font-semibold text-ink mb-1"
            >
              ประเภทฝั่งบัญชี
            </label>
            <select
              id="admin-cat-dir"
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as 'income' | 'expense')
              }
              className="w-full px-3 py-2 rounded-inner border border-border-strong bg-surface"
            >
              <option value="income">รายรับ (Income)</option>
              <option value="expense">รายจ่าย (Expense)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="admin-cat-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <label htmlFor="admin-cat-active" className="font-semibold text-ink">
              เปิดใช้งานหมวดหมู่นี้ (Enabled)
            </label>
          </div>

          <div>
            <label
              htmlFor="admin-cat-reason"
              className="block font-semibold text-ink mb-1"
            >
              เหตุผลในการบันทึก (Audit Reason)
            </label>
            <input
              id="admin-cat-reason"
              type="text"
              required
              minLength={5}
              placeholder="เช่น เพิ่มหมวดหมู่มาตรฐานสำหรับร้านค้าออนไลน์"
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
            <span>บันทึกหมวดหมู่กลาง</span>
          </button>
        </form>

        <div className="lg:col-span-7 mm-card-outer p-5 space-y-3">
          <h2 className="text-sm font-bold text-ink">
            หมวดหมู่เริ่มต้นทั้งหมด ({categories.length})
          </h2>
          <div className="divide-y divide-border text-xs">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="py-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-inner"
                    style={{ backgroundColor: cat.color_hex }}
                  />
                  <span className="font-semibold text-ink">{cat.name}</span>
                  <span className="text-ink-muted">
                    ({cat.direction === 'income' ? 'รายรับ' : 'รายจ่าย'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setName(cat.name);
                    setDirection(cat.direction);
                    setIsActive(cat.is_active);
                  }}
                  className="text-brand font-semibold hover:underline"
                >
                  เลือกแก้ไข ({cat.is_active ? 'Active' : 'Disabled'})
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
