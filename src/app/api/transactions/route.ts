import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCustomerSession } from '@/lib/security/auth-session';
import {
  MoneyMateRepo,
  readDatabase,
  writeDatabase,
} from '@/lib/supabase/repository';
import { calculateDashboardSummary } from '@/lib/analytics/dashboard-calc';
import { resolveVatStatus } from '@/lib/ai/extraction-schema';

const UpdateTransactionSchema = z.object({
  id: z.string().min(1),
  transaction_date: z.string().nullable().optional(),
  transaction_time: z.string().nullable().optional(),
  direction: z
    .enum(['income', 'expense', 'internal_transfer', 'needs_review'])
    .optional(),
  category_name: z.string().min(1).optional(),
  sender_name: z.string().nullable().optional(),
  receiver_name: z.string().nullable().optional(),
  merchant_name: z.string().nullable().optional(),
  sender_bank: z.string().nullable().optional(),
  receiver_bank: z.string().nullable().optional(),
  subtotal: z.number().nonnegative().nullable().optional(),
  vat_amount: z.number().nonnegative().nullable().optional(),
  tax_rate: z.number().nonnegative().nullable().optional(),
  total_amount: z.number().nonnegative().optional(),
  reference_id: z.string().nullable().optional(),
  status: z
    .enum([
      'processing',
      'pending_review',
      'confirmed',
      'duplicate',
      'failed',
    ])
    .optional(),
  notes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const id = searchParams.get('id');

    if (id) {
      const tx = MoneyMateRepo.getTransactionByIdForUser(user.id, id);
      if (!tx) {
        return NextResponse.json(
          { error: 'ไม่พบรายการธุรกรรม หรือคุณไม่มีสิทธิ์เข้าถึง (IDOR Protected)' },
          { status: 404 }
        );
      }
      const docs = MoneyMateRepo.getDocumentsForUser(user.id);
      const doc = docs.find((d) => d.id === tx.document_id) || null;
      return NextResponse.json({
        transaction: tx,
        document: doc,
        signedDocumentUrl: doc
          ? `/api/transactions?signedDocId=${encodeURIComponent(doc.id)}&exp=${
              Date.now() + 300_000
            }`
          : null,
      });
    }

    const allTxs = MoneyMateRepo.getTransactionsForUser(user.id);
    const categories = MoneyMateRepo.getCategoriesForUser(user.id);
    const summary = calculateDashboardSummary(
      allTxs,
      { startDate, endDate },
      categories
    );
    const wallet = MoneyMateRepo.getWalletForUser(user.id);
    const business = MoneyMateRepo.getBusinessAccount(user.id);
    const jobs = MoneyMateRepo.getJobsForUser(user.id);

    return NextResponse.json({
      user,
      business,
      wallet,
      categories,
      transactions: allTxs,
      jobs,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลได้' },
      { status: 401 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const body = await request.json();
    const parsed = UpdateTransactionSchema.parse(body);

    const existing = MoneyMateRepo.getTransactionByIdForUser(user.id, parsed.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบรายการธุรกรรมหรือไม่มีสิทธิ์แก้ไข' },
        { status: 404 }
      );
    }

    const nextSubtotal =
      parsed.subtotal !== undefined ? parsed.subtotal : existing.subtotal;
    const nextVat =
      parsed.vat_amount !== undefined ? parsed.vat_amount : existing.vat_amount;
    const nextTaxRate =
      parsed.tax_rate !== undefined ? parsed.tax_rate : existing.tax_rate;
    const nextTotal =
      parsed.total_amount !== undefined
        ? parsed.total_amount
        : existing.total_amount;

    const vatStatus = resolveVatStatus({
      document_type: existing.document_type,
      subtotal: nextSubtotal,
      vat_amount: nextVat,
      tax_rate: nextTaxRate,
      total_amount: nextTotal,
    });

    const updated = MoneyMateRepo.updateTransactionForUser(user.id, parsed.id, {
      ...parsed,
      amount: nextTotal,
      total_amount: nextTotal,
      vat_status: vatStatus,
      needs_review: parsed.status === 'confirmed' ? false : existing.needs_review,
    });

    return NextResponse.json({
      ok: true,
      transaction: updated,
      message: 'บันทึกการแก้ไขข้อมูลธุรกรรมเรียบร้อยแล้ว',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.errors[0]?.message
            : err instanceof Error
              ? err.message
              : 'ไม่สามารถบันทึกการแก้ไขได้',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสรายการที่ต้องการลบ' }, { status: 400 });
    }

    MoneyMateRepo.deleteTransactionForUser(user.id, id);
    const wallet = MoneyMateRepo.getWalletForUser(user.id);

    return NextResponse.json({
      ok: true,
      walletBalance: wallet.balance,
      message: 'ลบรายการธุรกรรมเรียบร้อยแล้ว (ประวัติเครดิตยังคงถูกต้องตามเดิม)',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ไม่สามารถลบรายการได้' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const body = await request.json();

    // Manage Categories or Business Settings through clean actions
    if (body.action === 'update_business') {
      const updated = MoneyMateRepo.updateBusinessAccount(user.id, {
        owner_name: body.owner_name,
        business_name: body.business_name,
        bank_name: body.bank_name,
        account_number: body.account_number,
        account_aliases: Array.isArray(body.account_aliases)
          ? body.account_aliases
          : String(body.account_aliases || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        currency: body.currency || 'THB',
        default_income_category: body.default_income_category,
        default_expense_category: body.default_expense_category,
      });
      return NextResponse.json({
        ok: true,
        business: updated,
        message: 'บันทึกข้อมูลโปรไฟล์ธุรกิจและบัญชีธนาคารเรียบร้อยแล้ว',
      });
    }

    if (body.action === 'create_category') {
      const name = String(body.name || '').trim();
      const direction = body.direction === 'income' ? 'income' : 'expense';
      const colorHex = String(body.color_hex || '#2563EB');
      if (name.length < 2) {
        return NextResponse.json(
          { error: 'ชื่อหมวดหมู่ต้องมีอย่างน้อย 2 ตัวอักษร' },
          { status: 400 }
        );
      }
      const db = readDatabase();
      const newCat = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name,
        direction: direction as 'income' | 'expense',
        color_hex: colorHex,
        is_default: false,
        is_active: true,
      };
      db.categories.push(newCat);
      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        category: newCat,
        categories: MoneyMateRepo.getCategoriesForUser(user.id),
      });
    }

    if (body.action === 'update_category') {
      const db = readDatabase();
      const cat = db.categories.find(
        (c) => c.id === body.id && c.user_id === user.id && !c.is_default
      );
      if (!cat) {
        return NextResponse.json(
          { error: 'แก้ไขได้เฉพาะหมวดหมู่ที่คุณสร้างเองเท่านั้น' },
          { status: 403 }
        );
      }
      if (body.name) cat.name = String(body.name).trim();
      if (body.color_hex) cat.color_hex = String(body.color_hex);
      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        categories: MoneyMateRepo.getCategoriesForUser(user.id),
      });
    }

    if (body.action === 'delete_category') {
      const db = readDatabase();
      const idx = db.categories.findIndex(
        (c) => c.id === body.id && c.user_id === user.id && !c.is_default
      );
      if (idx < 0) {
        return NextResponse.json(
          { error: 'ลบได้เฉพาะหมวดหมู่ส่วนตัวที่คุณสร้างเองเท่านั้น' },
          { status: 403 }
        );
      }
      db.categories.splice(idx, 1);
      writeDatabase(db);
      return NextResponse.json({
        ok: true,
        categories: MoneyMateRepo.getCategoriesForUser(user.id),
      });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่ง' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' },
      { status: 400 }
    );
  }
}
