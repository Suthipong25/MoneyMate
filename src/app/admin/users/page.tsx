'use client';

import React, { useEffect, useState } from 'react';
import { Search, Coins, Ban, CheckCircle2 } from 'lucide-react';
import type { UserProfile } from '@/types/domain';

interface AdminUserRow extends UserProfile {
  business_name: string;
  credit_balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [msg, setMsg] = useState<string | null>(null);

  // Modal state for credit adjustment / status toggle with mandatory reason
  const [modalUser, setModalUser] = useState<AdminUserRow | null>(null);
  const [modalMode, setModalMode] = useState<'credits' | 'status'>('credits');
  const [creditDelta, setCreditDelta] = useState<number>(20);
  const [auditReason, setAuditReason] = useState<string>('');

  const loadUsers = async () => {
    const res = await fetch('/api/admin');
    const data = await res.json();
    if (data.users) setUsers(data.users);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.business_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const submitAdminAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalUser) return;
    setMsg(null);

    const payload =
      modalMode === 'credits'
        ? {
            action: 'adjust_credits',
            userId: modalUser.id,
            delta: creditDelta,
            reason: auditReason,
          }
        : {
            action: 'toggle_user_status',
            userId: modalUser.id,
            reason: auditReason,
          };

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      setModalUser(null);
      setAuditReason('');
      await loadUsers();
    } else {
      setMsg(data.error || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          จัดการผู้ใช้งานและยอดเครดิต (User Management)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          ค้นหาผู้ใช้ ตรวจสอบแพ็กเกจ ยอดเครดิตคงเหลือ ระงับ/เปิดใช้งานบัญชี หรือปรับเครดิตพร้อมบันทึกเหตุผลลง Audit Log
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          {msg}
        </div>
      )}

      {/* Search & Filter */}
      <div className="mm-card-outer p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            aria-label="ค้นหาผู้ใช้งาน"
            placeholder="ค้นหาด้วยอีเมล, ชื่อผู้ใช้ หรือชื่อธุรกิจ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-inner border border-border-strong"
          />
        </div>
        <select
          aria-label="กรองตามสถานะบัญชี"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as typeof statusFilter)
          }
          className="px-3 py-2 rounded-inner border border-border-strong bg-surface"
        >
          <option value="all">ทุกสถานะบัญชี</option>
          <option value="active">ใช้งานปกติ (Active)</option>
          <option value="suspended">ถูกระงับ (Suspended)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">ผู้ใช้งาน / อีเมล</th>
                <th className="py-3 px-3 font-semibold">ชื่อธุรกิจ</th>
                <th className="py-3 px-3 font-semibold">Role</th>
                <th className="py-3 px-3 font-semibold">สถานะ</th>
                <th className="py-3 px-3 font-semibold text-right">เครดิตคงเหลือ</th>
                <th className="py-3 px-4 font-semibold text-right">คำสั่งจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-surface-muted/50">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-ink">{u.full_name}</p>
                    <p className="text-ink-muted">{u.email}</p>
                  </td>
                  <td className="py-3 px-3 text-ink-secondary">
                    {u.business_name}
                  </td>
                  <td className="py-3 px-3 font-mono">{u.role}</td>
                  <td className="py-3 px-3">
                    {u.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-income font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-expense font-semibold">
                        <Ban className="w-3.5 h-3.5" />
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-brand tabular-nums">
                    {u.credit_balance} เครดิต
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModalUser(u);
                          setModalMode('credits');
                          setCreditDelta(20);
                          setAuditReason('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-inner bg-brand-soft text-brand font-semibold"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>ปรับเครดิต</span>
                      </button>

                      {u.role !== 'super_admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalUser(u);
                            setModalMode('status');
                            setAuditReason('');
                          }}
                          className={`px-2.5 py-1 rounded-inner font-semibold ${
                            u.status === 'active'
                              ? 'bg-expense-soft text-expense'
                              : 'bg-income-soft text-income'
                          }`}
                        >
                          {u.status === 'active' ? 'ระงับบัญชี' : 'ปลดระงับ'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog with Mandatory Audit Reason */}
      {modalUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
        >
          <form
            onSubmit={submitAdminAction}
            className="max-w-md w-full mm-card-outer p-6 space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-ink">
              {modalMode === 'credits'
                ? `ปรับเพิ่ม/ลดเครดิตของ ${modalUser.email}`
                : `${
                    modalUser.status === 'active' ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'
                  }บัญชี ${modalUser.email}`}
            </h2>

            {modalMode === 'credits' && (
              <div>
                <label
                  htmlFor="admin-credit-delta"
                  className="block font-semibold text-ink mb-1"
                >
                  จำนวนเครดิตที่ต้องการเพิ่ม (+) หรือลด (-)
                </label>
                <input
                  id="admin-credit-delta"
                  type="number"
                  required
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-inner border border-border-strong font-bold tabular-nums"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="admin-audit-reason"
                className="block font-semibold text-ink mb-1"
              >
                เหตุผลในการดำเนินการ (บังคับระบุเพื่อบันทึกใน Audit Log อย่างน้อย 5 ตัวอักษร)
              </label>
              <textarea
                id="admin-audit-reason"
                required
                minLength={5}
                rows={3}
                placeholder="เช่น ชดเชยเครดิตให้ลูกค้าตามเคสแจ้งปัญหา #104"
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                className="w-full px-3 py-2 rounded-inner border border-border-strong"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalUser(null)}
                className="px-4 py-2 font-semibold border border-border-strong rounded-inner"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
              >
                ยืนยันและบันทึก Audit Log
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
