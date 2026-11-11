'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  UploadCloud,
} from 'lucide-react';
import type { ProcessingJob } from '@/types/domain';
import { formatThaiDate } from '@/lib/utils/formatters';

export default function ProcessingResultsPage() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    const res = await fetch('/api/transactions');
    const data = await res.json();
    if (data.jobs) setJobs(data.jobs);
    setLoading(false);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleRetry = async (jobId: string) => {
    setStatusMsg('กำลังส่งงานกลับเข้าคิวและประมวลผลใหม่...');
    await fetch(`/api/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearFailureHint: true }),
    });
    await fetch('/api/jobs/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: [jobId], concurrency: 1 }),
    });
    await loadJobs();
    setStatusMsg('ประมวลผลซ้ำสำเร็จ (ระบบป้องกันการหักเครดิตซ้ำอัตโนมัติ)');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            สถานะและผลลัพธ์การประมวลผล AI (Processing Results)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            ตรวจสอบประวัติคิวงาน AI สถานะการหักเครดิต และสั่ง Retry งานที่ล้มเหลวได้ตลอดเวลา
          </p>
        </div>
        <Link
          href="/app/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
        >
          <UploadCloud className="w-4 h-4" />
          <span>อัปโหลดรูปเพิ่ม</span>
        </Link>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-inner bg-brand-soft text-brand text-xs font-medium">
          {statusMsg}
        </div>
      )}

      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">ไฟล์เอกสาร</th>
                <th className="py-3 px-3 font-semibold">โมเดล AI</th>
                <th className="py-3 px-3 font-semibold">จำนวนครั้งที่รัน</th>
                <th className="py-3 px-3 font-semibold">การหักเครดิต</th>
                <th className="py-3 px-3 font-semibold">สถานะ</th>
                <th className="py-3 px-4 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    กำลังโหลดข้อมูลคิวงาน...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    ยังไม่มีประวัติคิวงานประมวลผล
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-muted/50">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-ink">
                        {job.file_name || job.document_id}
                      </p>
                      <p className="text-ink-muted tabular-nums">
                        {formatThaiDate(job.created_at)}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono text-ink-secondary">
                      {job.model_used || 'gemini-3.8-flash'}
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      {job.attempts} / {job.max_attempts}
                    </td>
                    <td className="py-3 px-3">
                      {job.credit_deducted ? (
                        <span className="px-2 py-0.5 rounded-inner bg-brand-soft text-brand font-semibold">
                          หัก 1 เครดิต
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-inner bg-surface-muted text-ink-secondary">
                          ไม่เสียเครดิต (0)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {job.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-income font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          สำเร็จ
                        </span>
                      ) : job.status === 'failed' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-expense font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            ล้มเหลว
                          </span>
                          {job.error_message && (
                            <p className="text-[11px] text-expense mt-0.5">
                              {job.error_message}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-brand font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          {job.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {job.status === 'failed' ? (
                        <button
                          type="button"
                          onClick={() => handleRetry(job.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand text-white font-semibold rounded-inner hover:bg-brand-hover"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry งานนี้</span>
                        </button>
                      ) : (
                        <Link
                          href="/app/transactions"
                          className="text-brand font-semibold hover:underline"
                        >
                          ดูรายการธุรกรรม
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
