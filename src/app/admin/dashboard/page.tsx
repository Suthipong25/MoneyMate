'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  TrendingUp,
  CreditCard,
  FileText,
  Cpu,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';
import type { AuditLogEntry } from '@/types/domain';
import { formatTHB, formatThaiDate } from '@/lib/utils/formatters';

interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  totalPayments: number;
  totalDocuments: number;
  aiSuccessRate: number;
  failedJobsCount: number;
}

export default function AdminOverviewDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    fetch('/api/admin')
      .then((r) => r.json())
      .then((d) => {
        if (d.overview) setOverview(d.overview);
        if (d.auditLogs) setRecentLogs(d.auditLogs.slice(0, 6));
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          แดชบอร์ดผู้ดูแลระบบสูงสุด (Admin Overview Dashboard)
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          ติดตามสถิติภาพรวมของระบบ รายได้รวม อัตราความสำเร็จของ AI และคิวงานที่ล้มเหลวโดยไม่ละเมิดความเป็นส่วนตัวของเอกสารการเงินลูกค้า
        </p>
      </div>

      {/* 7 Required System KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="mm-card-outer p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>ผู้ใช้ทั้งหมด (Total Users)</span>
            <Users className="w-4 h-4 text-brand" />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {overview?.totalUsers ?? 0} บัญชี
          </p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>ผู้ใช้ที่เปิดใช้งาน (Active Users)</span>
            <UserCheck className="w-4 h-4 text-income" />
          </div>
          <p className="text-2xl font-bold text-income tabular-nums">
            {overview?.activeUsers ?? 0} บัญชี
          </p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>รายได้รวม (Total Revenue)</span>
            <TrendingUp className="w-4 h-4 text-income" />
          </div>
          <p className="text-2xl font-bold text-income tabular-nums">
            {formatTHB(overview?.totalRevenue ?? 0)}
          </p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>รายการชำระเงินสำเร็จ (Total Payments)</span>
            <CreditCard className="w-4 h-4 text-brand" />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {overview?.totalPayments ?? 0} รายการ
          </p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>จำนวนเอกสารทั้งหมด (Total Documents)</span>
            <FileText className="w-4 h-4 text-brand" />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {overview?.totalDocuments ?? 0} ใบ
          </p>
        </div>

        <div className="mm-card-outer p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>อัตราความสำเร็จ AI (AI Success Rate)</span>
            <Cpu className="w-4 h-4 text-income" />
          </div>
          <p className="text-2xl font-bold text-brand tabular-nums">
            {overview?.aiSuccessRate ?? 100}%
          </p>
        </div>

        <div className="mm-card-outer p-5 space-y-1 sm:col-span-2">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>คิวงานที่ประมวลผลล้มเหลว (Failed Processing Jobs)</span>
            <AlertTriangle className="w-4 h-4 text-expense" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-2xl font-bold text-expense tabular-nums">
              {overview?.failedJobsCount ?? 0} งาน
            </p>
            <Link
              href="/admin/jobs"
              className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-inner"
            >
              ตรวจสอบและสั่ง Retry
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="mm-card-outer p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-bold text-ink">
              ประวัติการปฏิบัติงานของ Admin ล่าสุด (Audit Trail)
            </h2>
          </div>
          <Link
            href="/admin/audit-logs"
            className="text-xs font-semibold text-brand hover:underline"
          >
            ดู Audit Logs ทั้งหมด
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-ink-secondary">
                <th className="py-2 pr-3">เวลา</th>
                <th className="py-2 px-3">ผู้ดำเนินการ</th>
                <th className="py-2 px-3">คำสั่ง (Action)</th>
                <th className="py-2 pl-3">เหตุผลที่บันทึกไว้ (Reason)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {formatThaiDate(log.created_at)}
                  </td>
                  <td className="py-2.5 px-3 font-medium">
                    {log.admin_email || log.admin_id}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-brand">
                    {log.action}
                  </td>
                  <td className="py-2.5 pl-3 text-ink-secondary">
                    {log.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
