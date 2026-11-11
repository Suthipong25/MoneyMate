'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  UploadCloud,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { ProcessingJob } from '@/types/domain';

interface StagedFile {
  id: string;
  fileName: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/jpg' | 'image/webp';
  fileSizeBytes: number;
  base64Data: string;
  scenarioHint?: string;
}

export default function UploadDocumentsPage() {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const handleFileInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    if (stagedFiles.length + files.length > 100) {
      setErrorMsg('อัปโหลดได้สูงสุด 100 รูปต่อรอบ (Batch) เท่านั้น');
      return;
    }

    const nextItems: StagedFile[] = [];
    for (const file of Array.from(files)) {
      if (
        !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(
          file.type
        )
      ) {
        setErrorMsg(`ไฟล์ ${file.name} ไม่ใช่รูปภาพ PNG, JPG หรือ WEBP`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`ไฟล์ ${file.name} มีขนาดเกิน 10MB`);
        continue;
      }

      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });

      nextItems.push({
        id: `${Date.now()}-${Math.random()}`,
        fileName: file.name,
        mimeType: file.type as StagedFile['mimeType'],
        fileSizeBytes: file.size,
        base64Data,
      });
    }

    setStagedFiles((prev) => [...prev, ...nextItems].slice(0, 100));
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const startBatchQueueProcessing = async () => {
    if (stagedFiles.length === 0) return;
    setErrorMsg(null);
    setIsProcessing(true);
    setProgressPercent(5);

    try {
      // Step 1: Upload batch to Private Storage & create queued jobs
      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: stagedFiles }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setErrorMsg(uploadData.error || 'อัปโหลดไม่สำเร็จ');
        setIsProcessing(false);
        return;
      }

      const batchId = uploadData.batchId;
      let currentJobs: ProcessingJob[] = uploadData.jobs || [];
      setJobs(currentJobs);
      setStagedFiles([]);

      // Step 2: Process queue in controlled concurrency waves (3 jobs per wave)
      let remaining = uploadData.queuedCount;
      const total = currentJobs.length;

      while (remaining > 0) {
        const procRes = await fetch('/api/jobs/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId, concurrency: 3 }),
        });
        const procData = await procRes.json();
        if (!procRes.ok) {
          setErrorMsg(procData.error || 'เกิดข้อผิดพลาดระหว่างประมวลผลคิวงาน');
          break;
        }

        currentJobs = procData.jobs || currentJobs;
        remaining = procData.remainingQueued ?? 0;
        if (typeof procData.walletBalance === 'number') {
          setWalletBalance(procData.walletBalance);
        }

        const doneCount = total - remaining;
        setProgressPercent(Math.round((doneCount / Math.max(1, total)) * 100));
        setJobs([...currentJobs]);
      }

      setProgressPercent(100);
    } catch {
      setErrorMsg('ไม่สามารถติดต่อเซิร์ฟเวอร์ประมวลผลได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryFailedJob = async (jobId: string) => {
    setErrorMsg(null);
    const retryRes = await fetch(`/api/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearFailureHint: true }),
    });
    const retryData = await retryRes.json();
    if (!retryRes.ok) {
      setErrorMsg(retryData.error || 'ไม่สามารถสั่ง Retry ได้');
      return;
    }

    // Process the retried job immediately
    const procRes = await fetch('/api/jobs/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: [jobId], concurrency: 1 }),
    });
    const procData = await procRes.json();
    if (procRes.ok && procData.jobs) {
      const updatedJob = procData.jobs.find((j: ProcessingJob) => j.id === jobId);
      if (updatedJob) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? updatedJob : j)));
      }
      if (typeof procData.walletBalance === 'number') {
        setWalletBalance(procData.walletBalance);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/sticker-laptop.png"
            alt="MoneyMate AI อัปโหลดสลิป"
            width={56}
            height={56}
            className="w-14 h-14 object-contain shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-ink">
              อัปโหลดสลิปธนาคาร ใบเสร็จ และใบกำกับภาษี (Batch Upload)
            </h1>
            <p className="text-xs text-ink-secondary mt-0.5">
              รองรับไฟล์ PNG, JPG, JPEG, WEBP สูงสุด 100 รูปต่อรอบ ประมวลผลแบบ Queue พร้อมตรวจสลิปซ้ำ 2 ระดับ
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-inner bg-expense-soft border border-expense/30 text-xs font-medium text-expense"
        >
          {errorMsg}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div className="mm-card-outer p-8 border-2 border-dashed border-border-strong text-center space-y-3">
        <div className="w-12 h-12 rounded-inner bg-brand-soft text-brand flex items-center justify-center mx-auto">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="batch-file-upload"
            className="cursor-pointer text-sm font-bold text-brand hover:underline"
          >
            คลิกเพื่อเลือกรูปสลิปหรือใบเสร็จ (เลือกพร้อมกันได้สูงสุด 100 รูป)
          </label>
          <input
            id="batch-file-upload"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => handleFileInput(e.target.files)}
            className="sr-only"
          />
          <p className="text-xs text-ink-muted">
            รองรับ PNG, JPG, JPEG, WEBP ขนาดไม่เกิน 10MB ต่อรูป — เก็บใน Supabase Private Storage
          </p>
        </div>
      </div>

      {/* Staged Files Preview List (Before Processing) */}
      {stagedFiles.length > 0 && (
        <div className="mm-card-outer p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">
              รายการรูปที่เตรียมประมวลผล ({stagedFiles.length} / 100 รูป)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStagedFiles([])}
                className="px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-expense"
              >
                ล้างทั้งหมด
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={startBatchQueueProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
              >
                <Play className="w-3.5 h-3.5" />
                <span>เริ่มประมวลผลด้วย AI ({stagedFiles.length} รูป)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stagedFiles.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-inner border border-border flex items-center justify-between gap-3 bg-surface-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.base64Data}
                    alt={item.fileName}
                    className="w-10 h-10 rounded-inner object-cover border border-border bg-surface shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">
                      {item.fileName}
                    </p>
                    <p className="text-[11px] text-ink-muted tabular-nums">
                      {(item.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`ลบไฟล์ ${item.fileName}`}
                  onClick={() => removeStagedFile(item.id)}
                  className="p-1.5 text-ink-muted hover:text-expense rounded-inner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue Progress & Job Results */}
      {(isProcessing || jobs.length > 0) && (
        <div className="mm-card-outer p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink">
                สถานะคิวประมวลผล (Queue Processing Progress)
              </h2>
              <p className="text-xs text-ink-muted">
                รายการที่ล้มเหลวหรือซ้ำจะไม่ถูกหักเครดิต และสามารถกด Retry ได้ทันที
              </p>
            </div>
            {walletBalance !== null && (
              <span className="text-xs font-semibold px-3 py-1 rounded-inner bg-brand-soft text-brand tabular-nums">
                เครดิตคงเหลือหลังประมวลผล: {walletBalance} เครดิต
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span>ความคืบหน้าของ Batch</span>
              <span className="tabular-nums font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-surface-muted rounded-inner overflow-hidden">
              <div
                className="h-full bg-brand"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Per-File Job Status List */}
          <div className="divide-y divide-border">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-ink">
                    {job.file_name || job.document_id}
                  </p>
                  {job.error_message ? (
                    <p className="text-expense">{job.error_message}</p>
                  ) : job.validated_output ? (
                    <p className="text-ink-secondary tabular-nums">
                      ประเภท: {job.validated_output.document_type} / ยอดสุทธิ:{' '}
                      {job.validated_output.total_amount} บาท / Ref:{' '}
                      {job.validated_output.reference_id || '-'}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {job.status === 'processing' || job.status === 'queued' ? (
                    <span className="inline-flex items-center gap-1.5 text-brand font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังประมวลผล...
                    </span>
                  ) : job.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1.5 text-income font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {job.credit_deducted
                        ? 'สำเร็จ (-1 เครดิต)'
                        : 'ตรวจพบซ้ำ (0 เครดิต)'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-expense font-semibold">
                        <XCircle className="w-4 h-4" />
                        ล้มเหลว (ไม่หักเครดิต)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetryFailedJob(job.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand text-white font-semibold rounded-inner hover:bg-brand-hover"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Link
              href="/app/transactions"
              className="px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner"
            >
              ไปที่หน้ารายการธุรกรรมทั้งหมด
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
