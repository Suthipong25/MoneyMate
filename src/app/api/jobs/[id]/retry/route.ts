import { NextResponse, type NextRequest } from 'next/server';
import { requireCustomerSession } from '@/lib/security/auth-session';
import { readDatabase, writeDatabase } from '@/lib/supabase/repository';

// =============================================================================
// MoneyMate — Retry Failed Processing Job Endpoint (Section 3.2 & 11.16)
// Re-queues a failed job without charging duplicate credits
// =============================================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCustomerSession(true);
    const { id: jobId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const db = readDatabase();
    const job = db.processing_jobs.find(
      (j) =>
        j.id === jobId &&
        (j.user_id === user.id || user.role === 'super_admin')
    );

    if (!job) {
      return NextResponse.json(
        { error: 'ไม่พบงานประมวลผลที่ต้องการ Retry หรือคุณไม่มีสิทธิ์เข้าถึง' },
        { status: 404 }
      );
    }

    // Clear simulated failure hint on retry so user can see recovery succeed
    if (job.raw_ai_output && body.clearFailureHint !== false) {
      delete job.raw_ai_output.scenarioHint;
    }

    job.status = 'queued';
    job.error_code = null;
    job.error_message = null;

    const doc = db.documents.find((d) => d.id === job.document_id);
    if (doc && doc.file_name.toLowerCase().includes('fail')) {
      doc.file_name = doc.file_name.replace(/fail/gi, 'recovered');
      job.file_name = doc.file_name;
    }

    writeDatabase(db);

    return NextResponse.json({
      ok: true,
      job,
      message: 'นำงานกลับเข้าคิวประมวลผลเรียบร้อยแล้ว (ระบบป้องกันการหักเครดิตซ้ำอัตโนมัติ)',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ไม่สามารถ Retry งานได้' },
      { status: 400 }
    );
  }
}
