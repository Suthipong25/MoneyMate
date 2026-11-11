import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCustomerSession } from '@/lib/security/auth-session';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { computeSHA256 } from '@/lib/utils/formatters';
import { checkTier1FileHashDuplicate } from '@/lib/classification/duplicate-detector';
import {
  MoneyMateRepo,
  readDatabase,
  writeDatabase,
} from '@/lib/supabase/repository';
import type { DocumentRecord, ProcessingJob } from '@/types/domain';

// =============================================================================
// MoneyMate — Batch Document Upload & Queue Dispatcher (Section 3.2)
// Supports up to 100 images per batch (PNG, JPG, JPEG, WEBP, <= 10MB each).
// Computes SHA-256 hash immediately (Tier 1 Duplicate Detection) and enqueues
// background jobs without sending 100 images into AI in a single request.
// =============================================================================

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_BATCH = 100;

const UploadFileItemSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  base64Data: z.string().min(8),
  scenarioHint: z.string().optional(),
});

const BatchUploadRequestSchema = z.object({
  files: z
    .array(UploadFileItemSchema)
    .min(1, 'กรุณาเลือกรูปภาพอย่างน้อย 1 รูป')
    .max(MAX_FILES_PER_BATCH, 'อัปโหลดได้สูงสุด 100 รูปต่อรอบ (Batch)'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const rl = checkRateLimit({
      key: `upload_${user.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'อัปโหลดบ่อยเกินกำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = BatchUploadRequestSchema.parse(body);

    const wallet = MoneyMateRepo.getWalletForUser(user.id);
    if (wallet.balance < 1) {
      return NextResponse.json(
        {
          error:
            'เครดิตคงเหลือของคุณเป็น 0 กรุณาเติมเครดิตก่อนเริ่มประมวลผลเอกสารรอบใหม่',
          code: 'INSUFFICIENT_CREDITS',
        },
        { status: 402 }
      );
    }

    const db = readDatabase();
    const batchId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const createdJobs: ProcessingJob[] = [];
    const createdDocuments: DocumentRecord[] = [];

    for (const fileItem of parsed.files) {
      if (!ALLOWED_MIME_TYPES.has(fileItem.mimeType)) {
        throw new Error(`ไฟล์ ${fileItem.fileName} ไม่ใช่รูปภาพที่รองรับ (PNG, JPG, WEBP)`);
      }

      const rawBuffer = Buffer.from(
        fileItem.base64Data.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );
      const sha256 = computeSHA256(rawBuffer);

      // Tier 1 Check: SHA-256 Exact File Hash against user's existing documents
      const tier1 = checkTier1FileHashDuplicate(user.id, sha256, db.documents);

      const docId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const safeFileName = fileItem.fileName.replace(/[^a-zA-Z0-9._-ก-๙]/g, '_');
      const storagePath = `${user.id}/${batchId}/${docId}_${safeFileName}`;

      const docRecord: DocumentRecord = {
        id: docId,
        user_id: user.id,
        batch_id: batchId,
        file_name: fileItem.fileName,
        mime_type: fileItem.mimeType,
        file_size_bytes: fileItem.fileSizeBytes,
        storage_path: storagePath,
        file_hash_sha256: sha256,
        status: tier1.isDuplicate ? 'completed' : 'queued',
        is_duplicate_hash: tier1.isDuplicate,
        duplicate_of_document_id: tier1.originalDocument?.id || null,
        preview_data_url: fileItem.base64Data.startsWith('data:')
          ? fileItem.base64Data.slice(0, 4096)
          : undefined,
        created_at: nowIso,
      };

      const jobRecord: ProcessingJob = {
        id: jobId,
        user_id: user.id,
        document_id: docId,
        file_name: fileItem.fileName,
        batch_id: batchId,
        status: tier1.isDuplicate ? 'completed' : 'queued',
        attempts: tier1.isDuplicate ? 1 : 0,
        max_attempts: 3,
        model_used: tier1.isDuplicate ? 'sha256-tier1-dedup' : null,
        raw_ai_output: fileItem.scenarioHint
          ? { scenarioHint: fileItem.scenarioHint }
          : null,
        validated_output: null,
        error_code: tier1.isDuplicate ? 'DUPLICATE_FILE_HASH' : null,
        error_message: tier1.isDuplicate
          ? `ตรวจพบไฟล์รูปภาพซ้ำ 100% (SHA-256 ตรงกับไฟล์ ${tier1.originalDocument?.file_name}) ไม่หักเครดิต`
          : null,
        credit_deducted: false,
        started_at: tier1.isDuplicate ? nowIso : null,
        completed_at: tier1.isDuplicate ? nowIso : null,
        created_at: nowIso,
      };

      // If Tier 1 duplicate, record a 'duplicate' transaction notice without deducting credit
      if (tier1.isDuplicate) {
        const origTx = db.transactions.find(
          (t) =>
            t.user_id === user.id &&
            t.document_id === tier1.originalDocument?.id
        );
        db.transactions.unshift({
          id: crypto.randomUUID(),
          user_id: user.id,
          document_id: docId,
          job_id: jobId,
          document_type: origTx?.document_type || 'bank_slip',
          transaction_date: origTx?.transaction_date || nowIso.slice(0, 10),
          transaction_time: origTx?.transaction_time || null,
          sender_name: origTx?.sender_name || null,
          receiver_name: origTx?.receiver_name || null,
          sender_bank: origTx?.sender_bank || null,
          receiver_bank: origTx?.receiver_bank || null,
          merchant_name: origTx?.merchant_name || null,
          description: `[ไฟล์ซ้ำ SHA-256] ${fileItem.fileName}`,
          amount: origTx?.amount || 0,
          subtotal: origTx?.subtotal ?? null,
          vat_amount: origTx?.vat_amount ?? null,
          tax_rate: origTx?.tax_rate ?? null,
          total_amount: origTx?.total_amount || 0,
          vat_status: origTx?.vat_status || 'none',
          direction: origTx?.direction || 'needs_review',
          category_id: origTx?.category_id || null,
          category_name: origTx?.category_name || 'รายการซ้ำ',
          reference_id: origTx?.reference_id || null,
          confidence: 1,
          needs_review: false,
          review_reason: `ตรวจพบไฟล์ซ้ำด้วย SHA-256 คู่กับรายการต้นฉบับ (${origTx?.id || tier1.originalDocument?.id})`,
          status: 'duplicate',
          duplicate_of_id: origTx?.id || null,
          notes: 'ระบบป้องกันการบันทึกซ้ำและไม่หักเครดิต',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      db.documents.unshift(docRecord);
      db.processing_jobs.unshift(jobRecord);
      createdDocuments.push(docRecord);
      createdJobs.push(jobRecord);
    }

    writeDatabase(db);

    return NextResponse.json({
      ok: true,
      batchId,
      totalUploaded: createdJobs.length,
      queuedCount: createdJobs.filter((j) => j.status === 'queued').length,
      instantDuplicateCount: createdJobs.filter((j) => j.status === 'completed')
        .length,
      jobs: createdJobs,
      documents: createdDocuments,
    });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors[0]?.message || 'ข้อมูลไฟล์ไม่ถูกต้อง'
        : err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
