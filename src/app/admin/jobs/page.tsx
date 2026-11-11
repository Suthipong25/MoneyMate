'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle2, XCircle, Cpu } from 'lucide-react';
import type { ProcessingJob } from '@/types/domain';
import { formatThaiDate } from '@/lib/utils/formatters';

export default function AdminAiJobsPage() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const [msg, setMsg] = useState<string | null>(null);

  const loadJobs = async () => {
    const res = await fetch('/api/admin');
    const data = await res.json();
    if (data.jobs) setJobs(data.jobs);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleForceRetry = async (jobId: string) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'retry_failed_job',
        jobId,
        reason: 'Admin สั่ง Retry งานประมวลผลที่ล้มเหลวผ่านระบบจัดการคิว AI',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      await loadJobs();
    } else {
      setMsg(data.error);
    }
  };

  const displayed = jobs.filter((j) =>
    filter === 'failed' ? j.status === 'failed' : true
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            จัดการคิวประมวลผล AI และตรวจสอบ API Errors (AI Processing Management)
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            ติดตามสถานะคิวงาน AI ดูสาเหตุความล้มเหลว และสั่ง Retry งานที่ล้มเหลวโดยไม่หักเครดิตซ้ำ
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-inner font-semibold ${
              filter === 'all'
                ? 'bg-ink text-white'
                : 'bg-surface border border-border-strong'
            }`}
          >
            ทุกงาน ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('failed')}
            className={`px-3 py-1.5 rounded-inner font-semibold ${
              filter === 'failed'
                ? 'bg-expense text-white'
                : 'bg-surface border border-border-strong'
            }`}
          >
            เฉพาะงานที่ล้มเหลว ({jobs.filter((j) => j.status === 'failed').length})
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-inner bg-brand-soft text-brand text-xs font-semibold">
          {msg}
        </div>
      )}

      <div className="mm-card-outer overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-secondary">
                <th className="py-3 px-4 font-semibold">Job ID / เวลา</th>
                <th className="py-3 px-3 font-semibold">โมเดล AI</th>
                <th className="py-3 px-3 font-semibold">Attempts</th>
                <th className="py-3 px-3 font-semibold">สถานะ</th>
                <th className="py-3 px-3 font-semibold">API Error / หมายเหตุ</th>
                <th className="py-3 px-4 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.map((job) => (
                <tr key={job.id}>
                  <td className="py-3 px-4">
                    <p className="font-mono font-semibold text-ink">
                      {job.id.slice(0, 12)}
                    </p>
                    <p className="text-ink-muted tabular-nums">
                      {formatThaiDate(job.created_at)}
                    </p>
                  </td>
                  <td className="py-3 px-3 font-mono text-ink-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-brand" />
                      {job.model_used || 'gemini-3.8-flash'}
                    </span>
                  </td>
                  <td className="py-3 px-3 tabular-nums">
                    {job.attempts} / {job.max_attempts}
                  </td>
                  <td className="py-3 px-3">
                    {job.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-income font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-expense font-semibold">
                        <XCircle className="w-3.5 h-3.5" />
                        {job.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-ink-secondary max-w-xs truncate">
                    {job.error_message || 'สำเร็จปกติ'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleForceRetry(job.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand text-white font-semibold rounded-inner"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Force Retry</span>
                      </button>
                    )}
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
