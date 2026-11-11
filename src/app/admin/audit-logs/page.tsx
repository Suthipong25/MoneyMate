'use client';

import React, { useEffect, useState } from 'react';
import { ScrollText, ShieldCheck } from 'lucide-react';
import type { AuditLogEntry } from '@/types/domain';
import { formatThaiDate } from '@/lib/utils/formatters';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    fetch('/api/admin')
      .then((r) => r.json())
      .then((d) => {
        if (d.auditLogs) setLogs(d.auditLogs);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            บันทึกการตรวจสอบการทำงานของผู้ดูแลระบบ (Immutable Audit Logs)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            เก็บประวัติทุกการเปลี่ยนแปลงสถานะผู้ใช้ การปรับเครดิต การแก้ไขแพ็กเกจ และการจัดการการชำระเงิน พร้อมค่าก่อน-หลังแก้ไข
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          Append-Only Audit Trail
        </span>
      </div>

      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">วัน-เวลา</th>
                <th className="py-3 px-3 font-semibold">ผู้ดูแลระบบ (Admin)</th>
                <th className="py-3 px-3 font-semibold">คำสั่ง (Action)</th>
                <th className="py-3 px-3 font-semibold">เป้าหมาย (Target)</th>
                <th className="py-3 px-3 font-semibold">เหตุผลที่ระบุ (Reason)</th>
                <th className="py-3 px-4 font-semibold">การเปลี่ยนแปลง (Before → After)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-muted/50">
                  <td className="py-3 px-4 tabular-nums">
                    {formatThaiDate(log.created_at)}
                  </td>
                  <td className="py-3 px-3 font-medium">
                    {log.admin_email || log.admin_id}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-brand">
                      <ScrollText className="w-3.5 h-3.5" />
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-ink-secondary">
                    {log.target_user_email || log.entity_id || '-'}
                  </td>
                  <td className="py-3 px-3 font-medium text-ink">
                    {log.reason}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-ink-muted max-w-xs truncate">
                    {JSON.stringify(log.before_state)} →{' '}
                    {JSON.stringify(log.after_state)}
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
