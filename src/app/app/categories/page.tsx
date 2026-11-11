'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import type { CategoryItem } from '@/types/domain';

export default function CustomerCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'income' | 'expense'>('expense');
  const [colorHex, setColorHex] = useState('#2563EB');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories);
      });
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_category',
        name,
        direction,
        color_hex: colorHex,
      }),
    });
    const data = await res.json();
    if (res.ok && data.categories) {
      setCategories(data.categories);
      setName('');
      setMsg('เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว');
    } else {
      setMsg(data.error || 'ไม่สามารถเพิ่มหมวดหมู่ได้');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_category', id }),
    });
    const data = await res.json();
    if (res.ok && data.categories) {
      setCategories(data.categories);
      setMsg('ลบหมวดหมู่ส่วนตัวเรียบร้อยแล้ว');
    }
  };

  const incomeCats = categories.filter((c) => c.direction === 'income');
  const expenseCats = categories.filter((c) => c.direction === 'expense');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          จัดการหมวดหมู่รายรับ-รายจ่าย (Category Management)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          หมวดหมู่เริ่มต้นของระบบพร้อมใช้งานทันที และคุณสามารถเพิ่มหมวดหมู่เฉพาะของธุรกิจคุณเองได้ไม่จำกัด
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          {msg}
        </div>
      )}

      {/* Add Custom Category Form */}
      <form
        onSubmit={handleAddCategory}
        className="mm-card-outer p-5 flex flex-wrap items-end gap-4 text-xs"
      >
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="new-cat-name"
            className="block font-semibold text-ink mb-1"
          >
            ชื่อหมวดหมู่ใหม่
          </label>
          <input
            id="new-cat-name"
            type="text"
            required
            placeholder="เช่น ค่าแพ็กเกจจิ้ง, รายได้ตัวแทนจำหน่าย"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-inner border border-border-strong"
          />
        </div>

        <div>
          <label
            htmlFor="new-cat-dir"
            className="block font-semibold text-ink mb-1"
          >
            ฝั่งบัญชี
          </label>
          <select
            id="new-cat-dir"
            value={direction}
            onChange={(e) =>
              setDirection(e.target.value as 'income' | 'expense')
            }
            className="px-3 py-2 rounded-inner border border-border-strong bg-surface"
          >
            <option value="income">รายรับ (Income)</option>
            <option value="expense">รายจ่าย (Expense)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="new-cat-color"
            className="block font-semibold text-ink mb-1"
          >
            สีสัญลักษณ์
          </label>
          <input
            id="new-cat-color"
            type="color"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            className="h-9 w-16 rounded-inner border border-border-strong cursor-pointer"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มหมวดหมู่</span>
        </button>
      </form>

      {/* Two Columns: Income Categories & Expense Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="mm-card-outer p-5 space-y-3">
          <h2 className="text-sm font-bold text-income">
            หมวดหมู่รายรับ ({incomeCats.length})
          </h2>
          <div className="divide-y divide-border text-xs">
            {incomeCats.map((cat) => (
              <div
                key={cat.id}
                className="py-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-inner"
                    style={{ backgroundColor: cat.color_hex }}
                  />
                  <span className="font-medium text-ink">{cat.name}</span>
                </div>
                {cat.is_default ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                    <Lock className="w-3 h-3" />
                    ค่าเริ่มต้นระบบ
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`ลบหมวดหมู่ ${cat.name}`}
                    onClick={() => handleDelete(cat.id)}
                    className="text-ink-muted hover:text-expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mm-card-outer p-5 space-y-3">
          <h2 className="text-sm font-bold text-expense">
            หมวดหมู่รายจ่าย ({expenseCats.length})
          </h2>
          <div className="divide-y divide-border text-xs">
            {expenseCats.map((cat) => (
              <div
                key={cat.id}
                className="py-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-inner"
                    style={{ backgroundColor: cat.color_hex }}
                  />
                  <span className="font-medium text-ink">{cat.name}</span>
                </div>
                {cat.is_default ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                    <Lock className="w-3 h-3" />
                    ค่าเริ่มต้นระบบ
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`ลบหมวดหมู่ ${cat.name}`}
                    onClick={() => handleDelete(cat.id)}
                    className="text-ink-muted hover:text-expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
