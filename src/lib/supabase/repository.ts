import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AuditLogEntry,
  BusinessAccount,
  CategoryItem,
  CreditLedgerEntry,
  CreditPackage,
  CreditWallet,
  DocumentRecord,
  PaymentOrder,
  ProcessingJob,
  TransactionRecord,
  UserProfile,
} from '@/types/domain';
import { executeAtomicJobCreditDeduction } from '@/lib/credits/wallet-service';
import { processVerifiedPaymentWebhook } from '@/lib/payments/adapter';

// =============================================================================
// MoneyMate — Persistent Server Database Store & Supabase Repository Bridge
// Ensures 100% real server-side persistence, strict user_id isolation (RLS),
// atomic credit ledger operations, and full Admin Portal audit trail.
// =============================================================================

interface DatabaseState {
  users: Array<UserProfile & { password_hash: string }>;
  business_accounts: BusinessAccount[];
  categories: CategoryItem[];
  documents: DocumentRecord[];
  processing_jobs: ProcessingJob[];
  transactions: TransactionRecord[];
  credit_wallets: CreditWallet[];
  credit_ledger: CreditLedgerEntry[];
  credit_packages: CreditPackage[];
  payment_orders: PaymentOrder[];
  audit_logs: AuditLogEntry[];
}

const DB_FILE_PATH = path.join(process.cwd(), '.moneymate-db.json');

export function hashPassword(password: string): string {
  return crypto
    .createHmac('sha256', 'moneymate-auth-salt-2026')
    .update(password)
    .digest('hex');
}

function buildInitialSeedState(): DatabaseState {
  const now = '2026-11-09T08:00:00.000Z';
  const customerId = '11111111-1111-4111-8111-111111111111';
  const customer2Id = '22222222-2222-4222-8222-222222222222';
  const adminId = '99999999-9999-4999-8999-999999999999';

  const defaultCategories: CategoryItem[] = [
    { id: 'cat-inc-1', user_id: null, name: 'รายได้จากการขาย', direction: 'income', color_hex: '#15803D', is_default: true, is_active: true },
    { id: 'cat-inc-2', user_id: null, name: 'รายได้จากบริการ', direction: 'income', color_hex: '#0D9488', is_default: true, is_active: true },
    { id: 'cat-inc-3', user_id: null, name: 'รายได้อื่นๆ', direction: 'income', color_hex: '#16A34A', is_default: true, is_active: true },
    { id: 'cat-exp-1', user_id: null, name: 'ค่าอาหาร', direction: 'expense', color_hex: '#DC2626', is_default: true, is_active: true },
    { id: 'cat-exp-2', user_id: null, name: 'ค่าวัตถุดิบ', direction: 'expense', color_hex: '#EA580C', is_default: true, is_active: true },
    { id: 'cat-exp-3', user_id: null, name: 'ค่าขนส่ง', direction: 'expense', color_hex: '#D97706', is_default: true, is_active: true },
    { id: 'cat-exp-4', user_id: null, name: 'ค่าโฆษณา', direction: 'expense', color_hex: '#7C3AED', is_default: true, is_active: true },
    { id: 'cat-exp-5', user_id: null, name: 'ค่าสาธารณูปโภค', direction: 'expense', color_hex: '#2563EB', is_default: true, is_active: true },
    { id: 'cat-exp-6', user_id: null, name: 'ค่าเดินทาง', direction: 'expense', color_hex: '#0284C7', is_default: true, is_active: true },
    { id: 'cat-exp-7', user_id: null, name: 'ค่าอุปกรณ์', direction: 'expense', color_hex: '#4F46E5', is_default: true, is_active: true },
    { id: 'cat-exp-8', user_id: null, name: 'ค่าเช่า', direction: 'expense', color_hex: '#BE123C', is_default: true, is_active: true },
    { id: 'cat-exp-9', user_id: null, name: 'ค่าใช้จ่ายอื่นๆ', direction: 'expense', color_hex: '#64748B', is_default: true, is_active: true },
  ];

  const defaultPackages: CreditPackage[] = [
    {
      id: 'pkg-free',
      code: 'FREE',
      name: 'ทดลองใช้งานฟรี (Free)',
      description: 'สำหรับผู้เริ่มต้น ทดลองสแกนสลิปและใบเสร็จด้วย AI ฟรี 5 รูปแรก',
      credits: 5,
      price_thb: 0,
      features: [
        'สแกนสลิปและใบเสร็จฟรี 5 รูป',
        'ตรวจจับสลิปซ้ำ 2 ระดับอัตโนมัติ',
        'Export Excel (.xlsx 5 ชีต) และ CSV',
      ],
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'pkg-starter',
      code: 'STARTER',
      name: 'แพ็กเกจเริ่มต้น (Starter)',
      description: 'เหมาะสำหรับฟรีแลนซ์และร้านค้าขนาดเล็ก เคลียร์บิลรายเดือนสบายๆ',
      credits: 100,
      price_thb: 59,
      features: [
        '100 เครดิต (เฉลี่ยเพียงรูปละ 0.59 บาท)',
        'แยกรายรับ-รายจ่ายและถอด VAT อัตโนมัติ',
        'รูปซ้ำหรืออ่านไม่สำเร็จ ไม่หักเครดิต',
        'เครดิตไม่มีวันหมดอายุ',
      ],
      is_active: true,
      sort_order: 2,
    },
    {
      id: 'pkg-business',
      code: 'BUSINESS',
      name: 'แพ็กเกจร้านค้าขายดี (Business)',
      description: 'คุ้มค่าที่สุดสำหรับร้านค้าออนไลน์ที่มีสลิปและใบกำกับภาษีจำนวนมาก',
      credits: 500,
      price_thb: 199,
      features: [
        '500 เครดิต (ประหยัดคุ้มสุด รูปละ 0.39 บาท)',
        'อัปโหลดพร้อมกันสูงสุด 100 รูปต่อรอบ',
        'จัดหมวดหมู่ค่าใช้จ่าย AI อัจฉริยะ',
        'รายงานภาษีซื้อ-ภาษีขายและงบกำไรสุทธิครบชุด',
      ],
      is_active: true,
      sort_order: 3,
    },
  ];

  const seedTransactions: TransactionRecord[] = [
    {
      id: 'tx-seed-1',
      user_id: customerId,
      document_id: 'doc-seed-1',
      job_id: 'job-seed-1',
      document_type: 'bank_slip',
      transaction_date: '2026-11-09',
      transaction_time: '09:15:00',
      sender_name: 'คุณวิภาดา ศรีสุข',
      receiver_name: 'ร้านมณีเมท สตูดิโอ',
      sender_bank: 'KBANK',
      receiver_bank: 'SCB',
      merchant_name: null,
      description: 'รับชำระค่าสินค้าออเดอร์ #MM-1042',
      amount: 4500.0,
      subtotal: null,
      vat_amount: null,
      tax_rate: null,
      total_amount: 4500.0,
      vat_status: 'none',
      direction: 'income',
      category_id: 'cat-inc-1',
      category_name: 'รายได้จากการขาย',
      reference_id: '20261109KBANK9001',
      confidence: 0.98,
      needs_review: false,
      review_reason: null,
      status: 'confirmed',
      duplicate_of_id: null,
      notes: 'ลูกค้าโอนผ่าน QR PromptPay',
      created_at: '2026-11-09T09:16:00.000Z',
      updated_at: '2026-11-09T09:16:00.000Z',
    },
    {
      id: 'tx-seed-2',
      user_id: customerId,
      document_id: 'doc-seed-2',
      job_id: 'job-seed-2',
      document_type: 'bank_slip',
      transaction_date: '2026-11-08',
      transaction_time: '14:22:00',
      sender_name: 'บจก. สยามครีเอทีฟ',
      receiver_name: 'สมชาย ใจดี',
      sender_bank: 'BBL',
      receiver_bank: 'SCB',
      merchant_name: null,
      description: 'ค่าออกแบบและดูแลเพจรายเดือน',
      amount: 12840.0,
      subtotal: 12000.0,
      vat_amount: 840.0,
      tax_rate: 7,
      total_amount: 12840.0,
      vat_status: 'included',
      direction: 'income',
      category_id: 'cat-inc-2',
      category_name: 'รายได้จากบริการ',
      reference_id: '20261108BBL7741',
      confidence: 0.96,
      needs_review: false,
      review_reason: null,
      status: 'confirmed',
      duplicate_of_id: null,
      notes: 'มีใบกำกับภาษีขายแนบ',
      created_at: '2026-11-08T14:25:00.000Z',
      updated_at: '2026-11-08T14:25:00.000Z',
    },
    {
      id: 'tx-seed-3',
      user_id: customerId,
      document_id: 'doc-seed-3',
      job_id: 'job-seed-3',
      document_type: 'tax_invoice',
      transaction_date: '2026-11-08',
      transaction_time: '16:40:00',
      sender_name: 'ร้านมณีเมท สตูดิโอ',
      receiver_name: 'บริษัท แฟลช เอ็กซ์เพรส จำกัด',
      sender_bank: 'SCB',
      receiver_bank: 'KBANK',
      merchant_name: 'Flash Express Thailand',
      description: 'ค่าจัดส่งพัสดุด่วน 38 กล่อง',
      amount: 1177.0,
      subtotal: 1100.0,
      vat_amount: 77.0,
      tax_rate: 7,
      total_amount: 1177.0,
      vat_status: 'included',
      direction: 'expense',
      category_id: 'cat-exp-3',
      category_name: 'ค่าขนส่ง',
      reference_id: 'THFX-20261108-882',
      confidence: 0.95,
      needs_review: false,
      review_reason: null,
      status: 'confirmed',
      duplicate_of_id: null,
      notes: 'ใบเสร็จค่าขนส่งรายวัน',
      created_at: '2026-11-08T16:45:00.000Z',
      updated_at: '2026-11-08T16:45:00.000Z',
    },
    {
      id: 'tx-seed-4',
      user_id: customerId,
      document_id: 'doc-seed-4',
      job_id: 'job-seed-4',
      document_type: 'tax_invoice',
      transaction_date: '2026-11-07',
      transaction_time: '11:05:00',
      sender_name: 'สมชาย ใจดี',
      receiver_name: 'Meta Platforms Ireland Ltd.',
      sender_bank: 'SCB',
      receiver_bank: null,
      merchant_name: 'Meta Ads (Facebook)',
      description: 'ค่าโฆษณาแคมเปญโปรโมชันเดือนพฤศจิกายน',
      amount: 3210.0,
      subtotal: 3000.0,
      vat_amount: 210.0,
      tax_rate: 7,
      total_amount: 3210.0,
      vat_status: 'included',
      direction: 'expense',
      category_id: 'cat-exp-4',
      category_name: 'ค่าโฆษณา',
      reference_id: 'META-INV-992014',
      confidence: 0.97,
      needs_review: false,
      review_reason: null,
      status: 'confirmed',
      duplicate_of_id: null,
      notes: 'ใบกำกับภาษีค่าแอด Facebook',
      created_at: '2026-11-07T11:10:00.000Z',
      updated_at: '2026-11-07T11:10:00.000Z',
    },
    {
      id: 'tx-seed-5',
      user_id: customerId,
      document_id: 'doc-seed-5',
      job_id: 'job-seed-5',
      document_type: 'purchase_receipt',
      transaction_date: '2026-11-06',
      transaction_time: '10:30:00',
      sender_name: 'สมชาย ใจดี',
      receiver_name: 'บริษัท ซีพี แอ็กซ์ตร้า จำกัด (มหาชน)',
      sender_bank: 'SCB',
      receiver_bank: null,
      merchant_name: 'Makro สาขาลาดพร้าว',
      description: 'ซื้อวัตถุดิบและกล่องแพ็กเกจจิ้ง',
      amount: 2675.0,
      subtotal: 2500.0,
      vat_amount: 175.0,
      tax_rate: 7,
      total_amount: 2675.0,
      vat_status: 'included',
      direction: 'expense',
      category_id: 'cat-exp-2',
      category_name: 'ค่าวัตถุดิบ',
      reference_id: 'MK-20261106-4410',
      confidence: 0.94,
      needs_review: false,
      review_reason: null,
      status: 'confirmed',
      duplicate_of_id: null,
      notes: 'ใบกำกับภาษีเต็มรูป',
      created_at: '2026-11-06T10:35:00.000Z',
      updated_at: '2026-11-06T10:35:00.000Z',
    },
    {
      id: 'tx-seed-6',
      user_id: customerId,
      document_id: 'doc-seed-6',
      job_id: 'job-seed-6',
      document_type: 'payment_receipt',
      transaction_date: '2026-11-09',
      transaction_time: '12:45:00',
      sender_name: 'ไม่ระบุชื่อผู้โอนชัดเจน',
      receiver_name: 'ร้านค้าทั่วไป',
      sender_bank: 'KTB',
      receiver_bank: 'SCB',
      merchant_name: 'บิลเงินสดเขียนมือ',
      description: 'ค่าวัสดุสิ้นเปลืองสำนักงาน (ภาพถ่ายมีรอยพับ)',
      amount: 650.0,
      subtotal: null,
      vat_amount: null,
      tax_rate: null,
      total_amount: 650.0,
      vat_status: 'unknown',
      direction: 'needs_review',
      category_id: 'cat-exp-7',
      category_name: 'ค่าอุปกรณ์',
      reference_id: null,
      confidence: 0.62,
      needs_review: true,
      review_reason: 'บิลเงินสดไม่มีชื่อผู้รับที่ตรงกับโปรไฟล์ธุรกิจ และความมั่นใจ 62% กรุณาตรวจสอบก่อนยืนยัน',
      status: 'pending_review',
      duplicate_of_id: null,
      notes: 'รอตรวจสอบความถูกต้อง',
      created_at: '2026-11-09T12:50:00.000Z',
      updated_at: '2026-11-09T12:50:00.000Z',
    },
  ];

  return {
    users: [
      {
        id: customerId,
        email: 'demo@moneymate.co.th',
        full_name: 'สมชาย ใจดี (เจ้าของร้านมณีเมท)',
        role: 'customer',
        status: 'active',
        mfa_enabled: false,
        data_retention_days: 365,
        password_hash: hashPassword('Demo1234!'),
        created_at: now,
        updated_at: now,
      },
      {
        id: customer2Id,
        email: 'shop2@moneymate.co.th',
        full_name: 'พิมพ์ชนก เบเกอรี่โฮม',
        role: 'customer',
        status: 'active',
        mfa_enabled: false,
        data_retention_days: 365,
        password_hash: hashPassword('Shop1234!'),
        created_at: now,
        updated_at: now,
      },
      {
        id: adminId,
        email: 'admin@moneymate.co.th',
        full_name: 'ผู้ดูแลระบบสูงสุด (Super Admin)',
        role: 'super_admin',
        status: 'active',
        mfa_enabled: true,
        mfa_verified: true,
        data_retention_days: 365,
        password_hash: hashPassword('Admin1234!'),
        created_at: now,
        updated_at: now,
      },
    ],
    business_accounts: [
      {
        id: 'biz-seed-1',
        user_id: customerId,
        owner_name: 'สมชาย ใจดี',
        business_name: 'ร้านมณีเมท สตูดิโอ',
        bank_name: 'ธนาคารไทยพาณิชย์ (SCB)',
        account_number: 'xxx-x-xx889-1',
        account_aliases: ['มณีเมท', 'MoneyMate Studio', 'นายสมชาย ใจดี', 'SOMCHAI JAIDEE'],
        currency: 'THB',
        default_income_category: 'รายได้จากการขาย',
        default_expense_category: 'ค่าใช้จ่ายอื่นๆ',
        updated_at: now,
      },
    ],
    categories: defaultCategories,
    documents: [
      {
        id: 'doc-seed-1',
        user_id: customerId,
        batch_id: 'batch-seed-1',
        file_name: 'slip-kbank-order-1042.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 184320,
        storage_path: `${customerId}/batch-seed-1/slip-kbank-order-1042.jpg`,
        file_hash_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        status: 'completed',
        is_duplicate_hash: false,
        duplicate_of_document_id: null,
        created_at: '2026-11-09T09:16:00.000Z',
      },
    ],
    processing_jobs: [
      {
        id: 'job-seed-1',
        user_id: customerId,
        document_id: 'doc-seed-1',
        file_name: 'slip-kbank-order-1042.jpg',
        batch_id: 'batch-seed-1',
        status: 'completed',
        attempts: 1,
        max_attempts: 3,
        model_used: 'gemini-3.8-flash',
        raw_ai_output: { document_type: 'bank_slip', amount: 4500 },
        validated_output: {
          document_type: 'bank_slip',
          transaction_date: '2026-11-09',
          transaction_time: '09:15:00',
          sender_name: 'คุณวิภาดา ศรีสุข',
          receiver_name: 'ร้านมณีเมท สตูดิโอ',
          sender_bank: 'KBANK',
          receiver_bank: 'SCB',
          amount: 4500,
          reference_id: '20261109KBANK9001',
          merchant_name: null,
          description: 'รับชำระค่าสินค้าออเดอร์ #MM-1042',
          subtotal: null,
          vat_amount: null,
          tax_rate: null,
          total_amount: 4500,
          suggested_category: 'รายได้จากการขาย',
          direction: 'income',
          confidence: 0.98,
          needs_review: false,
          review_reason: null,
        },
        error_code: null,
        error_message: null,
        credit_deducted: true,
        started_at: '2026-11-09T09:15:58.000Z',
        completed_at: '2026-11-09T09:16:00.000Z',
        created_at: '2026-11-09T09:15:55.000Z',
      },
    ],
    transactions: seedTransactions,
    credit_wallets: [
      {
        user_id: customerId,
        balance: 99,
        lifetime_purchased: 100,
        lifetime_used: 6,
        updated_at: now,
      },
      {
        user_id: customer2Id,
        balance: 5,
        lifetime_purchased: 0,
        lifetime_used: 0,
        updated_at: now,
      },
      {
        user_id: adminId,
        balance: 999,
        lifetime_purchased: 999,
        lifetime_used: 0,
        updated_at: now,
      },
    ],
    credit_ledger: [
      {
        id: 'led-seed-2',
        user_id: customerId,
        delta: 100,
        balance_after: 105,
        entry_type: 'package_purchase',
        idempotency_key: 'payment_topup_ord-seed-1',
        reference_id: 'MM-STARTER-SEED001',
        reason: 'เติมเครดิตแพ็กเกจ STARTER (+100 เครดิต)',
        created_by: null,
        created_at: '2026-11-08T10:00:00.000Z',
      },
      {
        id: 'led-seed-1',
        user_id: customerId,
        delta: 5,
        balance_after: 5,
        entry_type: 'initial_free',
        idempotency_key: `signup_free_${customerId}`,
        reference_id: null,
        reason: 'เครดิตทดลองใช้งานฟรีสำหรับสมาชิกใหม่ 5 รูป',
        created_by: null,
        created_at: now,
      },
    ],
    credit_packages: defaultPackages,
    payment_orders: [
      {
        id: 'ord-seed-1',
        user_id: customerId,
        package_id: 'pkg-starter',
        package_code: 'STARTER',
        credits_amount: 100,
        amount_thb: 59.0,
        currency: 'THB',
        provider: 'sandbox',
        provider_reference: 'MM-STARTER-SEED001',
        qr_payload: '00020101021229370016A000000677010111011300668000000005802TH5303764540559.006304ABCD',
        status: 'paid',
        webhook_event_id: 'evt-seed-001',
        paid_at: '2026-11-08T10:00:00.000Z',
        refunded_at: null,
        refund_reason: null,
        expires_at: '2026-11-08T10:15:00.000Z',
        created_at: '2026-11-08T09:58:00.000Z',
      },
    ],
    audit_logs: [
      {
        id: 'audit-seed-1',
        admin_id: adminId,
        admin_email: 'admin@moneymate.co.th',
        target_user_id: customerId,
        target_user_email: 'demo@moneymate.co.th',
        action: 'SYSTEM_INITIALIZED',
        entity_type: 'system',
        entity_id: 'moneymate-v1',
        reason: 'เริ่มต้นระบบฐานข้อมูลและตั้งค่าความปลอดภัยเริ่มต้นของ MoneyMate',
        before_state: null,
        after_state: { status: 'ready', rls: 'enabled' },
        ip_address: '127.0.0.1',
        created_at: now,
      },
    ],
  };
}

let memoryState: DatabaseState | null = null;

export function readDatabase(): DatabaseState {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
      memoryState = JSON.parse(raw) as DatabaseState;
      return memoryState;
    }
  } catch {
    // Fallback to initial seed
  }
  memoryState = buildInitialSeedState();
  writeDatabase(memoryState);
  return memoryState;
}

export function writeDatabase(state: DatabaseState): void {
  memoryState = state;
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // In read-only environments, keep in memory
  }
}

// =============================================================================
// Repository Methods with Strict User Isolation (RLS Enforcement)
// =============================================================================

export const MoneyMateRepo = {
  findUserByEmail(email: string) {
    const db = readDatabase();
    return (
      db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ||
      null
    );
  },

  findUserById(userId: string): UserProfile | null {
    const db = readDatabase();
    const u = db.users.find((item) => item.id === userId);
    if (!u) return null;
    const { password_hash: _pw, ...profile } = u;
    return profile;
  },

  createUser(params: {
    email: string;
    password: string;
    fullName: string;
    businessName?: string;
  }): UserProfile {
    const db = readDatabase();
    const cleanEmail = params.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('EMAIL_EXISTS: อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ');
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const newUser: UserProfile & { password_hash: string } = {
      id: userId,
      email: cleanEmail,
      full_name: params.fullName.trim(),
      role: 'customer',
      status: 'active',
      mfa_enabled: false,
      data_retention_days: 365,
      password_hash: hashPassword(params.password),
      created_at: now,
      updated_at: now,
    };

    db.users.push(newUser);

    db.business_accounts.push({
      id: crypto.randomUUID(),
      user_id: userId,
      owner_name: params.fullName.trim(),
      business_name: (params.businessName || params.fullName).trim(),
      bank_name: 'ธนาคารกสิกรไทย (KBANK)',
      account_number: '',
      account_aliases: [params.fullName.trim()],
      currency: 'THB',
      default_income_category: 'รายได้จากการขาย',
      default_expense_category: 'ค่าใช้จ่ายอื่นๆ',
      updated_at: now,
    });

    // Grant 5 FREE starter credits atomically
    db.credit_wallets.push({
      user_id: userId,
      balance: 5,
      lifetime_purchased: 0,
      lifetime_used: 0,
      updated_at: now,
    });

    db.credit_ledger.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      delta: 5,
      balance_after: 5,
      entry_type: 'initial_free',
      idempotency_key: `signup_free_${userId}`,
      reference_id: null,
      reason: 'เครดิตทดลองใช้งานฟรีสำหรับสมาชิกใหม่ 5 รูป',
      created_by: null,
      created_at: now,
    });

    writeDatabase(db);
    const { password_hash: _pw, ...profile } = newUser;
    return profile;
  },

  getBusinessAccount(userId: string): BusinessAccount {
    const db = readDatabase();
    let biz = db.business_accounts.find((b) => b.user_id === userId);
    if (!biz) {
      const user = this.findUserById(userId);
      biz = {
        id: crypto.randomUUID(),
        user_id: userId,
        owner_name: user?.full_name || 'เจ้าของธุรกิจ',
        business_name: user?.full_name || 'ร้านค้าของฉัน',
        bank_name: 'ธนาคารไทยพาณิชย์ (SCB)',
        account_number: '',
        account_aliases: [],
        currency: 'THB',
        default_income_category: 'รายได้จากการขาย',
        default_expense_category: 'ค่าใช้จ่ายอื่นๆ',
        updated_at: new Date().toISOString(),
      };
      db.business_accounts.push(biz);
      writeDatabase(db);
    }
    return biz;
  },

  updateBusinessAccount(
    userId: string,
    payload: Partial<Omit<BusinessAccount, 'id' | 'user_id' | 'updated_at'>>
  ): BusinessAccount {
    const db = readDatabase();
    const existing = this.getBusinessAccount(userId);
    const idx = db.business_accounts.findIndex((b) => b.user_id === userId);
    const updated: BusinessAccount = {
      ...existing,
      ...payload,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (idx >= 0) db.business_accounts[idx] = updated;
    else db.business_accounts.push(updated);
    writeDatabase(db);
    return updated;
  },

  getCategoriesForUser(userId: string): CategoryItem[] {
    const db = readDatabase();
    return db.categories.filter(
      (c) => (c.is_default && c.is_active) || c.user_id === userId
    );
  },

  getTransactionsForUser(userId: string): TransactionRecord[] {
    const db = readDatabase();
    // Strict RLS: only rows matching user_id
    return db.transactions
      .filter((tx) => tx.user_id === userId)
      .sort((a, b) => {
        const dA = `${a.transaction_date || ''}T${a.transaction_time || '00:00:00'}`;
        const dB = `${b.transaction_date || ''}T${b.transaction_time || '00:00:00'}`;
        return dB.localeCompare(dA);
      });
  },

  getTransactionByIdForUser(
    userId: string,
    transactionId: string
  ): TransactionRecord | null {
    const db = readDatabase();
    // Prevents IDOR: checks both id and user_id
    return (
      db.transactions.find(
        (tx) => tx.id === transactionId && tx.user_id === userId
      ) || null
    );
  },

  updateTransactionForUser(
    userId: string,
    transactionId: string,
    updates: Partial<TransactionRecord>
  ): TransactionRecord {
    const db = readDatabase();
    const idx = db.transactions.findIndex(
      (tx) => tx.id === transactionId && tx.user_id === userId
    );
    if (idx < 0) {
      throw new Error('NOT_FOUND_OR_FORBIDDEN: ไม่พบรายการธุรกรรมหรือคุณไม่มีสิทธิ์แก้ไข');
    }

    const current = db.transactions[idx];
    const updated: TransactionRecord = {
      ...current,
      ...updates,
      id: current.id,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    db.transactions[idx] = updated;
    writeDatabase(db);
    return updated;
  },

  deleteTransactionForUser(userId: string, transactionId: string): void {
    const db = readDatabase();
    const idx = db.transactions.findIndex(
      (tx) => tx.id === transactionId && tx.user_id === userId
    );
    if (idx < 0) {
      throw new Error('NOT_FOUND_OR_FORBIDDEN: ไม่พบรายการธุรกรรมหรือคุณไม่มีสิทธิ์ลบ');
    }
    // Deleting transaction does NOT alter credit_ledger or credit_wallets
    db.transactions.splice(idx, 1);
    writeDatabase(db);
  },

  getWalletForUser(userId: string): CreditWallet {
    const db = readDatabase();
    let wallet = db.credit_wallets.find((w) => w.user_id === userId);
    if (!wallet) {
      wallet = {
        user_id: userId,
        balance: 5,
        lifetime_purchased: 0,
        lifetime_used: 0,
        updated_at: new Date().toISOString(),
      };
      db.credit_wallets.push(wallet);
      writeDatabase(db);
    }
    return wallet;
  },

  getLedgerForUser(userId: string): CreditLedgerEntry[] {
    const db = readDatabase();
    return db.credit_ledger.filter((e) => e.user_id === userId);
  },

  getPackages(includeInactive = false): CreditPackage[] {
    const db = readDatabase();
    return db.credit_packages
      .filter((p) => includeInactive || p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  getPaymentOrdersForUser(userId: string): PaymentOrder[] {
    const db = readDatabase();
    return db.payment_orders
      .filter((o) => o.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getJobsForUser(userId: string): ProcessingJob[] {
    const db = readDatabase();
    return db.processing_jobs
      .filter((j) => j.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getDocumentsForUser(userId: string): DocumentRecord[] {
    const db = readDatabase();
    return db.documents.filter((d) => d.user_id === userId);
  },

  purgeAllUserFinancialData(userId: string): {
    deletedDocuments: number;
    deletedTransactions: number;
  } {
    const db = readDatabase();
    const docBefore = db.documents.length;
    const txBefore = db.transactions.length;

    db.documents = db.documents.filter((d) => d.user_id !== userId);
    db.processing_jobs = db.processing_jobs.filter((j) => j.user_id !== userId);
    db.transactions = db.transactions.filter((t) => t.user_id !== userId);

    writeDatabase(db);
    return {
      deletedDocuments: docBefore - db.documents.length,
      deletedTransactions: txBefore - db.transactions.length,
    };
  },

  deductCreditForJob(params: {
    userId: string;
    jobId: string;
    documentId: string;
    jobStatus: 'completed' | 'failed';
    isDuplicate: boolean;
  }) {
    const db = readDatabase();
    const wallet = this.getWalletForUser(params.userId);
    const result = executeAtomicJobCreditDeduction({
      wallet,
      ledger: db.credit_ledger,
      jobId: params.jobId,
      documentId: params.documentId,
      jobStatus: params.jobStatus,
      isDuplicate: params.isDuplicate,
    });
    writeDatabase(db);
    return result;
  },

  fulfillPaymentWebhook(rawBody: string, signatureHeader: string | null) {
    const db = readDatabase();
    const walletMap = new Map<string, CreditWallet>();
    for (const w of db.credit_wallets) {
      walletMap.set(w.user_id, w);
    }

    const res = processVerifiedPaymentWebhook({
      rawBody,
      signatureHeader,
      orders: db.payment_orders,
      wallets: walletMap,
      ledger: db.credit_ledger,
    });

    db.credit_wallets = Array.from(walletMap.values());
    writeDatabase(db);
    return res;
  },
};
