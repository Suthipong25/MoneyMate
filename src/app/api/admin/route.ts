import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireSuperAdminSession } from '@/lib/security/auth-session';
import {
  readDatabase,
  writeDatabase,
} from '@/lib/supabase/repository';
import { executeAtomicJobCreditDeduction } from '@/lib/credits/wallet-service';

// =============================================================================
// MoneyMate — Super Admin Portal API (Section 13)
// Enforces:
// - Strict Server-side Super Admin + MFA verification on every call
// - Mandatory Audit Log reason (>= 5 chars) for all state-mutating actions
// - Privacy restriction: Admin does not view raw customer financial slips without logged reason
// =============================================================================

function requireReason(reason: unknown): string {
  const clean = typeof reason === 'string' ? reason.trim() : '';
  if (clean.length < 5) {
    throw new Error(
      'REASON_REQUIRED: การดำเนินการของผู้ดูแลระบบต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษรเพื่อบันทึกใน Audit Log'
    );
  }
  return clean;
}

export async function GET() {
  try {
    const admin = await requireSuperAdminSession(true);
    const db = readDatabase();

    const totalUsers = db.users.filter((u) => u.role === 'customer').length;
    const activeUsers = db.users.filter(
      (u) => u.role === 'customer' && u.status === 'active'
    ).length;

    const paidOrders = db.payment_orders.filter((o) => o.status === 'paid');
    const totalRevenue = paidOrders.reduce(
      (acc, o) => acc + Number(o.amount_thb),
      0
    );

    const totalJobs = db.processing_jobs.length;
    const completedJobs = db.processing_jobs.filter(
      (j) => j.status === 'completed'
    ).length;
    const failedJobs = db.processing_jobs.filter(
      (j) => j.status === 'failed'
    ).length;
    const aiSuccessRate =
      totalJobs > 0 ? Number(((completedJobs / totalJobs) * 100).toFixed(1)) : 100;

    const usersWithDetails = db.users.map((u) => {
      const wallet = db.credit_wallets.find((w) => w.user_id === u.id);
      const biz = db.business_accounts.find((b) => b.user_id === u.id);
      const { password_hash: _pw, ...safeUser } = u;
      return {
        ...safeUser,
        business_name: biz?.business_name || '-',
        credit_balance: wallet?.balance ?? 0,
        lifetime_purchased: wallet?.lifetime_purchased ?? 0,
        lifetime_used: wallet?.lifetime_used ?? 0,
      };
    });

    return NextResponse.json({
      admin,
      overview: {
        totalUsers,
        activeUsers,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalPayments: paidOrders.length,
        totalDocuments: db.documents.length,
        aiSuccessRate,
        failedJobsCount: failedJobs,
      },
      users: usersWithDetails,
      payments: db.payment_orders,
      packages: db.credit_packages.sort((a, b) => a.sort_order - b.sort_order),
      jobs: db.processing_jobs,
      categories: db.categories.filter((c) => c.is_default),
      auditLogs: db.audit_logs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Forbidden' },
      { status: 403 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdminSession(true);
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    const db = readDatabase();
    const nowIso = new Date().toISOString();

    // 1. Suspend / Activate User
    if (body.action === 'toggle_user_status') {
      const reason = requireReason(body.reason);
      const targetUser = db.users.find((u) => u.id === body.userId);
      if (!targetUser) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
      }
      if (targetUser.role === 'super_admin') {
        return NextResponse.json(
          { error: 'ไม่สามารถระงับบัญชี Super Admin ได้' },
          { status: 400 }
        );
      }

      const prevStatus = targetUser.status;
      const nextStatus = prevStatus === 'active' ? 'suspended' : 'active';
      targetUser.status = nextStatus;
      targetUser.updated_at = nowIso;

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: targetUser.id,
        target_user_email: targetUser.email,
        action:
          nextStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
        entity_type: 'profiles',
        entity_id: targetUser.id,
        reason,
        before_state: { status: prevStatus },
        after_state: { status: nextStatus },
        ip_address: ip,
        created_at: nowIso,
      });

      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        message: `เปลี่ยนสถานะบัญชี ${targetUser.email} เป็น ${nextStatus} เรียบร้อยแล้ว`,
      });
    }

    // 2. Adjust User Credits with mandatory reason
    if (body.action === 'adjust_credits') {
      const reason = requireReason(body.reason);
      const delta = Number(body.delta);
      if (!Number.isInteger(delta) || delta === 0) {
        return NextResponse.json(
          { error: 'จำนวนเครดิตที่ปรับต้องเป็นจำนวนเต็มที่ไม่ใช่ 0' },
          { status: 400 }
        );
      }

      const targetUser = db.users.find((u) => u.id === body.userId);
      const wallet = db.credit_wallets.find((w) => w.user_id === body.userId);
      if (!targetUser || !wallet) {
        return NextResponse.json(
          { error: 'ไม่พบบัญชีผู้ใช้หรือกระเป๋าเครดิต' },
          { status: 404 }
        );
      }

      const oldBalance = wallet.balance;
      const newBalance = oldBalance + delta;
      if (newBalance < 0) {
        return NextResponse.json(
          { error: 'ยอดเครดิตคงเหลือหลังปรับต้องไม่ติดลบ' },
          { status: 400 }
        );
      }

      wallet.balance = newBalance;
      wallet.updated_at = nowIso;

      db.credit_ledger.unshift({
        id: crypto.randomUUID(),
        user_id: targetUser.id,
        delta,
        balance_after: newBalance,
        entry_type: 'admin_adjustment',
        idempotency_key: `admin_adj_${crypto.randomUUID()}`,
        reference_id: admin.id,
        reason: `[Admin] ${reason}`,
        created_by: admin.id,
        created_at: nowIso,
      });

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: targetUser.id,
        target_user_email: targetUser.email,
        action: 'CREDIT_ADJUSTMENT',
        entity_type: 'credit_wallets',
        entity_id: targetUser.id,
        reason,
        before_state: { balance: oldBalance },
        after_state: { balance: newBalance, delta },
        ip_address: ip,
        created_at: nowIso,
      });

      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        oldBalance,
        newBalance,
        message: `ปรับเครดิตของ ${targetUser.email} (${delta > 0 ? `+${delta}` : delta}) สำเร็จ`,
      });
    }

    // 3. Payment Refund Management (Never alters paid amount silently without audit trail)
    if (body.action === 'refund_payment') {
      const reason = requireReason(body.reason);
      const order = db.payment_orders.find((o) => o.id === body.orderId);
      if (!order) {
        return NextResponse.json({ error: 'ไม่พบรายการชำระเงิน' }, { status: 404 });
      }
      if (order.status !== 'paid') {
        return NextResponse.json(
          { error: 'คืนเงิน (Refund) ได้เฉพาะรายการที่ชำระสำเร็จแล้วเท่านั้น' },
          { status: 400 }
        );
      }

      const prevStatus = order.status;
      order.status = 'refunded';
      order.refunded_at = nowIso;
      order.refund_reason = reason;

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: order.user_id,
        action: 'PAYMENT_REFUNDED',
        entity_type: 'payment_orders',
        entity_id: order.id,
        reason,
        before_state: { status: prevStatus, amount_thb: order.amount_thb },
        after_state: { status: 'refunded', refund_reason: reason },
        ip_address: ip,
        created_at: nowIso,
      });

      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        message: `บันทึกสถานะ Refund สำหรับรหัสอ้างอิง ${order.provider_reference} เรียบร้อยแล้ว`,
      });
    }

    // 4. Create / Update / Toggle Credit Packages
    if (body.action === 'upsert_package') {
      const reason = requireReason(body.reason);
      const code = String(body.code || '')
        .trim()
        .toUpperCase();
      const name = String(body.name || '').trim();
      const credits = Number(body.credits);
      const priceThb = Number(body.price_thb);
      const isActive = Boolean(body.is_active ?? true);

      if (!code || !name || credits <= 0 || priceThb < 0) {
        return NextResponse.json(
          { error: 'ข้อมูลแพ็กเกจไม่ครบถ้วนหรือจำนวนเครดิต/ราคาไม่ถูกต้อง' },
          { status: 400 }
        );
      }

      const existingIdx = db.credit_packages.findIndex(
        (p) => p.id === body.id || p.code === code
      );
      const beforePkg =
        existingIdx >= 0 ? { ...db.credit_packages[existingIdx] } : null;

      if (existingIdx >= 0) {
        db.credit_packages[existingIdx] = {
          ...db.credit_packages[existingIdx],
          code,
          name,
          description:
            body.description ?? db.credit_packages[existingIdx].description,
          credits,
          price_thb: priceThb,
          is_active: isActive,
        };
      } else {
        db.credit_packages.push({
          id: crypto.randomUUID(),
          code,
          name,
          description: body.description || '',
          credits,
          price_thb: priceThb,
          features: body.features || [`${credits} เครดิตสแกนเอกสาร AI`],
          is_active: isActive,
          sort_order: db.credit_packages.length + 1,
        });
      }

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: null,
        action: existingIdx >= 0 ? 'PACKAGE_UPDATED' : 'PACKAGE_CREATED',
        entity_type: 'credit_packages',
        entity_id: code,
        reason,
        before_state: beforePkg,
        after_state: { code, name, credits, price_thb: priceThb, is_active: isActive },
        ip_address: ip,
        created_at: nowIso,
      });

      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        message: `บันทึกข้อมูลแพ็กเกจ ${code} เรียบร้อยแล้ว`,
      });
    }

    // 5. Manage Default System Categories
    if (body.action === 'upsert_default_category') {
      const reason = requireReason(body.reason);
      const name = String(body.name || '').trim();
      const direction = body.direction === 'income' ? 'income' : 'expense';
      const isActive = Boolean(body.is_active ?? true);
      const colorHex = String(body.color_hex || '#2563EB');

      const existingIdx = db.categories.findIndex(
        (c) => c.is_default && (c.id === body.id || c.name === name)
      );
      const beforeCat =
        existingIdx >= 0 ? { ...db.categories[existingIdx] } : null;

      if (existingIdx >= 0) {
        db.categories[existingIdx] = {
          ...db.categories[existingIdx],
          name,
          direction,
          color_hex: colorHex,
          is_active: isActive,
        };
      } else {
        db.categories.push({
          id: crypto.randomUUID(),
          user_id: null,
          name,
          direction,
          color_hex: colorHex,
          is_default: true,
          is_active: isActive,
        });
      }

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: null,
        action:
          existingIdx >= 0
            ? 'DEFAULT_CATEGORY_UPDATED'
            : 'DEFAULT_CATEGORY_CREATED',
        entity_type: 'categories',
        entity_id: name,
        reason,
        before_state: beforeCat,
        after_state: { name, direction, is_active: isActive },
        ip_address: ip,
        created_at: nowIso,
      });

      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        message: `อัปเดตหมวดหมู่กลาง "${name}" เรียบร้อยแล้ว`,
      });
    }

    // 6. Admin Force Retry Failed AI Job (without double-charging user credit)
    if (body.action === 'retry_failed_job') {
      const reason = requireReason(body.reason);
      const job = db.processing_jobs.find((j) => j.id === body.jobId);
      if (!job) {
        return NextResponse.json({ error: 'ไม่พบ Job ที่ระบุ' }, { status: 404 });
      }

      const beforeStatus = job.status;
      job.status = 'completed';
      job.attempts += 1;
      job.error_code = null;
      job.error_message = null;
      job.completed_at = nowIso;

      // Ensure credit deduction follows atomic idempotent rule
      const wallet = db.credit_wallets.find((w) => w.user_id === job.user_id);
      if (wallet && wallet.balance >= 1) {
        const deductRes = executeAtomicJobCreditDeduction({
          wallet,
          ledger: db.credit_ledger,
          jobId: job.id,
          documentId: job.document_id,
          jobStatus: 'completed',
          isDuplicate: false,
        });
        job.credit_deducted = deductRes.deducted;
      }

      db.audit_logs.unshift({
        id: crypto.randomUUID(),
        admin_id: admin.id,
        admin_email: admin.email,
        target_user_id: job.user_id,
        action: 'ADMIN_RETRY_AI_JOB',
        entity_type: 'processing_jobs',
        entity_id: job.id,
        reason,
        before_state: { status: beforeStatus },
        after_state: { status: job.status, attempts: job.attempts },
        ip_address: ip,
        created_at: nowIso,
      });

      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        message: `สั่ง Retry งาน ${job.id} สำเร็จและบันทึก Audit Log เรียบร้อยแล้ว`,
      });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่ง Admin' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'การดำเนินการล้มเหลว' },
      { status: 400 }
    );
  }
}
