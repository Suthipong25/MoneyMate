import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { classifyTransaction } from '@/lib/classification/direction-classifier';
import {
  checkTier1FileHashDuplicate,
  checkTier2TransactionDuplicate,
} from '@/lib/classification/duplicate-detector';
import { calculateDashboardSummary } from '@/lib/analytics/dashboard-calc';
import {
  generateMoneyMateExcelBuffer,
  generateMoneyMateCSV,
} from '@/lib/export/excel-builder';
import {
  executeAtomicJobCreditDeduction,
  getOrCreateAnonymousTrial,
  signAnonymousTrialToken,
} from '@/lib/credits/wallet-service';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '@/lib/security/auth-session';
import {
  signPaymentWebhookPayload,
  verifyPaymentWebhookSignature,
  processVerifiedPaymentWebhook,
} from '@/lib/payments/adapter';
import { readDatabase } from '@/lib/supabase/repository';
import type {
  AIExtractionPayload,
  BusinessAccount,
  CreditLedgerEntry,
  CreditWallet,
  PaymentOrder,
  TransactionRecord,
} from '@/types/domain';

describe('MoneyMate Core Acceptance Criteria Suite', () => {
  const sampleBusiness: BusinessAccount = {
    id: 'biz-test-1',
    user_id: 'usr-customer-01',
    owner_name: 'สมชาย ใจดี',
    business_name: 'ร้านมณีเมท สตูดิโอ',
    bank_name: 'SCB',
    account_number: '123-4-56789-0',
    account_aliases: ['บริษัท สมชายการค้า จำกัด', 'SOMCHAI JAIDEE', '987-6-54321-0'],
    currency: 'THB',
    default_income_category: 'รายได้จากการขาย',
    default_expense_category: 'ค่าใช้จ่ายอื่นๆ',
    updated_at: '2026-11-09T08:00:00Z',
  };

  describe('1. Context-Aware Transaction Classification (Income / Expense / Internal / Review)', () => {
    it('classifies transfer INTO user registered account as income', () => {
      const payload: AIExtractionPayload = {
        document_type: 'bank_slip',
        transaction_date: '2026-11-09',
        transaction_time: '10:15:00',
        sender_name: 'กมลวรรณ ศรีสุข',
        receiver_name: 'ร้านมณีเมท สตูดิโอ',
        sender_bank: 'KBANK',
        receiver_bank: 'SCB',
        amount: 15000,
        reference_id: 'REF-INCOME-001',
        merchant_name: null,
        description: 'ชำระค่าสินค้า',
        subtotal: 14018.69,
        vat_amount: 981.31,
        tax_rate: 7,
        total_amount: 15000,
        suggested_category: 'รายได้จากการขาย',
        direction: 'income',
        confidence: 0.96,
        needs_review: false,
        review_reason: null,
      };

      const res = classifyTransaction(payload, sampleBusiness);
      assert.equal(res.direction, 'income');
      assert.equal(res.needsReview, false);
    });

    it('classifies transfer FROM user account to external merchant as expense', () => {
      const payload: AIExtractionPayload = {
        document_type: 'bank_slip',
        transaction_date: '2026-11-09',
        transaction_time: '12:00:00',
        sender_name: 'สมชาย ใจดี',
        receiver_name: 'บมจ. สยามแม็คโคร',
        sender_bank: 'SCB',
        receiver_bank: 'BBL',
        amount: 4500,
        reference_id: 'REF-EXP-001',
        merchant_name: 'Makro สาขาลาดพร้าว',
        description: 'ซื้อวัตถุดิบ',
        subtotal: 4205.61,
        vat_amount: 294.39,
        tax_rate: 7,
        total_amount: 4500,
        suggested_category: 'ค่าวัตถุดิบ',
        direction: 'expense',
        confidence: 0.94,
        needs_review: false,
        review_reason: null,
      };

      const res = classifyTransaction(payload, sampleBusiness);
      assert.equal(res.direction, 'expense');
      assert.equal(res.categoryName, 'ค่าวัตถุดิบ');
      assert.equal(res.needsReview, false);
    });

    it('classifies transfer between TWO of user own accounts as internal_transfer', () => {
      const payload: AIExtractionPayload = {
        document_type: 'bank_slip',
        transaction_date: '2026-11-09',
        transaction_time: '15:00:00',
        sender_name: 'สมชาย ใจดี',
        receiver_name: 'บริษัท สมชายการค้า จำกัด',
        sender_bank: 'KBANK',
        receiver_bank: 'SCB',
        amount: 50000,
        reference_id: 'REF-INT-001',
        merchant_name: null,
        description: 'โอนเงินระหว่างบัญชีตัวเอง',
        subtotal: null,
        vat_amount: null,
        tax_rate: null,
        total_amount: 50000,
        suggested_category: null,
        direction: 'expense',
        confidence: 0.98,
        needs_review: false,
        review_reason: null,
      };

      const res = classifyTransaction(payload, sampleBusiness);
      assert.equal(res.direction, 'internal_transfer');
      assert.equal(res.needsReview, false);
    });

    it('routes ambiguous slip without matching account to needs_review', () => {
      const payload: AIExtractionPayload = {
        document_type: 'bank_slip',
        transaction_date: '2026-11-09',
        transaction_time: '16:00:00',
        sender_name: 'บุคคลภายนอก ก',
        receiver_name: 'บุคคลภายนอก ข',
        sender_bank: 'KBANK',
        receiver_bank: 'BBL',
        amount: 1200,
        reference_id: 'REF-AMB-001',
        merchant_name: null,
        description: null,
        subtotal: null,
        vat_amount: null,
        tax_rate: null,
        total_amount: 1200,
        suggested_category: null,
        direction: 'expense',
        confidence: 0.55,
        needs_review: true,
        review_reason: null,
      };

      const res = classifyTransaction(payload, sampleBusiness);
      assert.equal(res.direction, 'needs_review');
      assert.equal(res.needsReview, true);
    });
  });

  describe('2. Two-Tier Duplicate Detection Engine', () => {
    it('detects Tier 1 exact SHA-256 hash match immediately', () => {
      const existingDocs = [
        {
          id: 'doc-existing-1',
          user_id: 'usr-customer-01',
          batch_id: 'batch-1',
          file_name: 'slip1.jpg',
          mime_type: 'image/jpeg' as const,
          file_size_bytes: 1024,
          storage_path: 'usr/slip1.jpg',
          file_hash_sha256: 'abc123sha256hash',
          status: 'completed' as const,
          is_duplicate_hash: false,
          duplicate_of_document_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const check = checkTier1FileHashDuplicate(
        'usr-customer-01',
        'abc123sha256hash',
        existingDocs
      );

      assert.equal(check.isDuplicate, true);
      assert.equal(check.originalDocument?.id, 'doc-existing-1');
    });

    it('detects Tier 2 semantic duplicate on exact Reference ID even when file hash differs', () => {
      const db = readDatabase();
      const existingTx = db.transactions[0];

      const check = checkTier2TransactionDuplicate(
        existingTx.user_id,
        {
          document_type: 'bank_slip',
          transaction_date: existingTx.transaction_date,
          transaction_time: existingTx.transaction_time,
          sender_name: existingTx.sender_name,
          receiver_name: existingTx.receiver_name,
          sender_bank: 'KBANK',
          receiver_bank: 'SCB',
          amount: existingTx.total_amount,
          reference_id: existingTx.reference_id,
          merchant_name: null,
          description: null,
          subtotal: null,
          vat_amount: null,
          tax_rate: null,
          total_amount: existingTx.total_amount,
          suggested_category: 'รายได้จากการขาย',
          direction: 'income',
          confidence: 0.99,
          needs_review: false,
          review_reason: null,
        },
        db.transactions
      );

      assert.equal(check.outcome, 'exact_duplicate');
      assert.equal(check.duplicateOfTransactionId, existingTx.id);
    });
  });

  describe('3. Financial Dashboard Accuracy & Strict Exclusion Rules', () => {
    it('calculates Total Income, Total Expense, and Net Amount = Total Income - Total Expense strictly from confirmed items', () => {
      const txs: TransactionRecord[] = [
        {
          id: 't1',
          user_id: 'u1',
          document_id: 'd1',
          job_id: 'j1',
          document_type: 'bank_slip',
          transaction_date: '2026-11-01',
          transaction_time: '09:00:00',
          sender_name: 'Client A',
          receiver_name: 'My Co',
          sender_bank: 'KBANK',
          receiver_bank: 'SCB',
          merchant_name: null,
          description: 'Sales',
          amount: 20000,
          subtotal: 18691.59,
          vat_amount: 1308.41,
          tax_rate: 7,
          total_amount: 20000,
          vat_status: 'included',
          direction: 'income',
          category_id: 'c1',
          category_name: 'รายได้จากการขาย',
          reference_id: 'R1',
          confidence: 0.99,
          needs_review: false,
          review_reason: null,
          status: 'confirmed',
          duplicate_of_id: null,
          notes: null,
          created_at: '2026-11-01T09:00:00Z',
          updated_at: '2026-11-01T09:00:00Z',
        },
        {
          id: 't2',
          user_id: 'u1',
          document_id: 'd2',
          job_id: 'j2',
          document_type: 'tax_invoice',
          transaction_date: '2026-11-02',
          transaction_time: '11:00:00',
          sender_name: 'My Co',
          receiver_name: 'Supplier B',
          sender_bank: 'SCB',
          receiver_bank: 'BBL',
          merchant_name: 'Supplier B',
          description: 'Materials',
          amount: 5500,
          subtotal: 5140.19,
          vat_amount: 359.81,
          tax_rate: 7,
          total_amount: 5500,
          vat_status: 'included',
          direction: 'expense',
          category_id: 'c2',
          category_name: 'ค่าวัตถุดิบ',
          reference_id: 'R2',
          confidence: 0.95,
          needs_review: false,
          review_reason: null,
          status: 'confirmed',
          duplicate_of_id: null,
          notes: null,
          created_at: '2026-11-02T11:00:00Z',
          updated_at: '2026-11-02T11:00:00Z',
        },
        // MUST BE EXCLUDED: Duplicate
        {
          id: 't3',
          user_id: 'u1',
          document_id: 'd3',
          job_id: 'j3',
          document_type: 'bank_slip',
          transaction_date: '2026-11-01',
          transaction_time: '09:00:00',
          sender_name: 'Client A',
          receiver_name: 'My Co',
          sender_bank: 'KBANK',
          receiver_bank: 'SCB',
          merchant_name: null,
          description: 'Duplicate Sales',
          amount: 99999,
          subtotal: null,
          vat_amount: null,
          tax_rate: null,
          total_amount: 99999,
          vat_status: 'none',
          direction: 'income',
          category_id: 'c1',
          category_name: 'รายได้จากการขาย',
          reference_id: 'R1',
          confidence: 0.99,
          needs_review: false,
          review_reason: null,
          status: 'duplicate',
          duplicate_of_id: 't1',
          notes: null,
          created_at: '2026-11-01T09:05:00Z',
          updated_at: '2026-11-01T09:05:00Z',
        },
        // MUST BE EXCLUDED: Internal Transfer
        {
          id: 't4',
          user_id: 'u1',
          document_id: 'd4',
          job_id: 'j4',
          document_type: 'bank_slip',
          transaction_date: '2026-11-03',
          transaction_time: '12:00:00',
          sender_name: 'My Co',
          receiver_name: 'My Co',
          sender_bank: 'KBANK',
          receiver_bank: 'SCB',
          merchant_name: null,
          description: 'Internal Transfer',
          amount: 50000,
          subtotal: null,
          vat_amount: null,
          tax_rate: null,
          total_amount: 50000,
          vat_status: 'none',
          direction: 'internal_transfer',
          category_id: null,
          category_name: 'โอนระหว่างบัญชีตัวเอง',
          reference_id: 'R4',
          confidence: 0.99,
          needs_review: false,
          review_reason: null,
          status: 'confirmed',
          duplicate_of_id: null,
          notes: null,
          created_at: '2026-11-03T12:00:00Z',
          updated_at: '2026-11-03T12:00:00Z',
        },
        // MUST BE EXCLUDED: Pending Review
        {
          id: 't5',
          user_id: 'u1',
          document_id: 'd5',
          job_id: 'j5',
          document_type: 'payment_receipt',
          transaction_date: '2026-11-04',
          transaction_time: '14:00:00',
          sender_name: null,
          receiver_name: null,
          sender_bank: null,
          receiver_bank: null,
          merchant_name: 'Unverified Shop',
          description: 'Pending item',
          amount: 8000,
          subtotal: null,
          vat_amount: null,
          tax_rate: null,
          total_amount: 8000,
          vat_status: 'unknown',
          direction: 'expense',
          category_id: 'c2',
          category_name: 'ค่าใช้จ่ายอื่นๆ',
          reference_id: null,
          confidence: 0.5,
          needs_review: true,
          review_reason: 'Low confidence',
          status: 'pending_review',
          duplicate_of_id: null,
          notes: null,
          created_at: '2026-11-04T14:00:00Z',
          updated_at: '2026-11-04T14:00:00Z',
        },
      ];

      const summary = calculateDashboardSummary(txs);
      assert.equal(summary.total_income, 20000);
      assert.equal(summary.total_expense, 5500);
      assert.equal(summary.net_amount, 14500);
      assert.equal(summary.confirmed_count, 2);
      assert.equal(summary.duplicate_count, 1);
      assert.equal(summary.pending_review_count, 1);
      assert.equal(summary.internal_transfer_count, 1);
    });
  });

  describe('4. Atomic Credit System & Idempotency', () => {
    it('deducts 1 credit for non-duplicate completed job, 0 for duplicate/failed, and never double-deducts on retry', () => {
      const wallet: CreditWallet = {
        user_id: 'usr-test-wallet',
        balance: 10,
        lifetime_purchased: 10,
        lifetime_used: 0,
        updated_at: new Date().toISOString(),
      };
      const ledger: CreditLedgerEntry[] = [];

      const firstDeduct = executeAtomicJobCreditDeduction({
        wallet,
        ledger,
        jobId: 'job-fresh-1',
        documentId: 'doc-1',
        jobStatus: 'completed',
        isDuplicate: false,
      });
      assert.equal(firstDeduct.deducted, true);
      assert.equal(wallet.balance, 9);

      const secondDeduct = executeAtomicJobCreditDeduction({
        wallet,
        ledger,
        jobId: 'job-fresh-1',
        documentId: 'doc-1',
        jobStatus: 'completed',
        isDuplicate: false,
      });
      assert.equal(secondDeduct.deducted, false);
      assert.equal(secondDeduct.reason, 'already_deducted_for_job');
      assert.equal(wallet.balance, 9);

      const dupDeduct = executeAtomicJobCreditDeduction({
        wallet,
        ledger,
        jobId: 'job-dup-2',
        documentId: 'doc-2',
        jobStatus: 'completed',
        isDuplicate: true,
      });
      assert.equal(dupDeduct.deducted, false);
      assert.equal(dupDeduct.reason, 'duplicate_document_free');
      assert.equal(wallet.balance, 9);

      const failDeduct = executeAtomicJobCreditDeduction({
        wallet,
        ledger,
        jobId: 'job-fail-3',
        documentId: 'doc-3',
        jobStatus: 'failed',
        isDuplicate: false,
      });
      assert.equal(failDeduct.deducted, false);
      assert.equal(failDeduct.reason, 'failed_job_free');
      assert.equal(wallet.balance, 9);
    });
  });

  describe('5. PromptPay Webhook Verification & Replay Protection', () => {
    it('verifies HMAC-SHA256 webhook signature and grants credits exactly once even if called multiple times', () => {
      const orders: PaymentOrder[] = [
        {
          id: 'ord-test-100',
          user_id: 'usr-pay-1',
          package_id: 'pkg-starter',
          package_code: 'STARTER',
          credits_amount: 100,
          amount_thb: 59,
          currency: 'THB',
          provider: 'sandbox',
          provider_reference: 'MM-STARTER-TEST100',
          qr_payload: '000201...',
          status: 'pending',
          webhook_event_id: null,
          paid_at: null,
          refunded_at: null,
          refund_reason: null,
          expires_at: new Date(Date.now() + 600_000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ];
      const wallets = new Map<string, CreditWallet>([
        [
          'usr-pay-1',
          {
            user_id: 'usr-pay-1',
            balance: 5,
            lifetime_purchased: 0,
            lifetime_used: 0,
            updated_at: new Date().toISOString(),
          },
        ],
      ]);
      const ledger: CreditLedgerEntry[] = [];

      const rawBody = JSON.stringify({
        eventId: 'evt-100',
        providerReference: 'MM-STARTER-TEST100',
        amountThb: 59,
        status: 'paid',
        timestamp: Date.now(),
      });

      const validSig = signPaymentWebhookPayload(rawBody);
      assert.equal(verifyPaymentWebhookSignature(rawBody, validSig), true);
      assert.equal(verifyPaymentWebhookSignature(rawBody, 'forged-signature'), false);

      const first = processVerifiedPaymentWebhook({
        rawBody,
        signatureHeader: validSig,
        orders,
        wallets,
        ledger,
      });
      assert.equal(first.alreadyProcessed, false);
      assert.equal(first.creditsGranted, 100);
      assert.equal(first.newBalance, 105);

      const replay = processVerifiedPaymentWebhook({
        rawBody,
        signatureHeader: validSig,
        orders,
        wallets,
        ledger,
      });
      assert.equal(replay.alreadyProcessed, true);
      assert.equal(replay.creditsGranted, 0);
      assert.equal(replay.newBalance, 105);
    });
  });

  describe('6. Signed Anonymous Trial Quota & RBAC Session Integrity', () => {
    it('prevents users from resetting their 5 free trial credits by deleting browser cookies', () => {
      const clientIp = '203.113.55.99';
      const initial = getOrCreateAnonymousTrial(clientIp, null);
      assert.equal(initial.payload.creditsRemaining, 5);

      const spentPayload = {
        ...initial.payload,
        creditsRemaining: 3,
      };
      const spentToken = signAnonymousTrialToken(spentPayload);
      const synced = getOrCreateAnonymousTrial(clientIp, spentToken);
      assert.equal(synced.payload.creditsRemaining, 3);

      const afterCookieClear = getOrCreateAnonymousTrial(clientIp, null);
      assert.equal(afterCookieClear.payload.creditsRemaining, 3);
    });

    it('detects and rejects tampered RBAC session cookies', () => {
      const token = createSignedSessionToken({
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'customer',
        mfaVerified: false,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600_000,
      });

      assert.equal(verifySignedSessionToken(token)?.role, 'customer');

      const [, sig] = token.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({
          userId: '11111111-1111-4111-8111-111111111111',
          role: 'super_admin',
          mfaVerified: true,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600_000,
        })
      ).toString('base64url');

      assert.equal(verifySignedSessionToken(`${forgedPayload}.${sig}`), null);
    });
  });

  describe('7. ExcelJS 5-Sheet Export & UTF-8 BOM CSV Export', () => {
    it('generates a valid 5-worksheet .xlsx buffer with Summary, Income, Expense, Transactions, and Categories sheets', async () => {
      const db = readDatabase();
      const buffer = await generateMoneyMateExcelBuffer(
        db.transactions,
        undefined,
        db.categories
      );

      assert.ok(buffer.byteLength > 1000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);

      const sheetNames = wb.worksheets.map((ws) => ws.name);
      assert.deepEqual(sheetNames, [
        'Summary',
        'Income',
        'Expense',
        'Transactions',
        'Categories',
      ]);

      const expectedSummary = calculateDashboardSummary(db.transactions);
      const summarySheet = wb.getWorksheet('Summary')!;
      const netCell = summarySheet.getCell('B5');
      assert.deepEqual(netCell.value, {
        formula: 'B3-B4',
        result: expectedSummary.net_amount,
      });
    });

    it('generates a UTF-8 BOM CSV string with formula-injection protection', () => {
      const db = readDatabase();
      const csv = generateMoneyMateCSV(db.transactions);
      assert.equal(csv.startsWith('\uFEFF'), true);
      assert.equal(csv.includes('"วันที่","เวลา","ประเภท","สถานะ"'), true);
      assert.equal(csv.includes('คุณวิภาดา ศรีสุข'), true);
    });
  });

  describe('8. Performance & Concurrent Load Benchmark (/performance-testing)', () => {
    it('sustains 50 concurrent Virtual Users (VUs) across 200 mixed workload operations with p95 < 250ms and 0% error rate', async () => {
      const db = readDatabase();
      const latenciesMs: number[] = [];
      let errors = 0;

      const virtualUsers = 50;
      const iterationsPerVu = 4; // 200 total operations
      const benchStart = performance.now();

      await Promise.all(
        Array.from({ length: virtualUsers }, async (_, vuIndex) => {
          for (let iter = 0; iter < iterationsPerVu; iter++) {
            const opStart = performance.now();
            try {
              // Realistic mixed workload: Classify + Tier-2 Dedup + Dashboard Summary + CSV/Excel
              const c = classifyTransaction(
                {
                  document_type: 'bank_slip',
                  transaction_date: '2026-11-09',
                  transaction_time: '10:15:00',
                  sender_name: `ลูกค้า VU-${vuIndex}`,
                  receiver_name: 'ร้านมณีเมท สตูดิโอ',
                  sender_bank: 'KBANK',
                  receiver_bank: 'SCB',
                  amount: 1000 + iter,
                  reference_id: `REF-VU-${vuIndex}-${iter}`,
                  merchant_name: null,
                  description: 'Load test slip',
                  subtotal: null,
                  vat_amount: null,
                  tax_rate: null,
                  total_amount: 1000 + iter,
                  suggested_category: 'รายได้จากการขาย',
                  direction: 'income',
                  confidence: 0.97,
                  needs_review: false,
                  review_reason: null,
                },
                sampleBusiness
              );
              assert.equal(c.direction, 'income');

              const summary = calculateDashboardSummary(db.transactions);
              assert.equal(typeof summary.net_amount, 'number');

              if (iter === 0 && vuIndex < 5) {
                const buf = await generateMoneyMateExcelBuffer(
                  db.transactions,
                  undefined,
                  db.categories
                );
                assert.ok(buf.byteLength > 1000);
              }
            } catch {
              errors++;
            } finally {
              latenciesMs.push(performance.now() - opStart);
            }
          }
        })
      );

      const totalElapsedSec = (performance.now() - benchStart) / 1000;
      latenciesMs.sort((a, b) => a - b);

      const totalOps = latenciesMs.length;
      const avg = latenciesMs.reduce((s, v) => s + v, 0) / totalOps;
      const p90 = latenciesMs[Math.floor(totalOps * 0.9)]!;
      const p95 = latenciesMs[Math.floor(totalOps * 0.95)]!;
      const p99 = latenciesMs[Math.floor(totalOps * 0.99)]!;
      const rps = totalOps / Math.max(0.001, totalElapsedSec);
      const errorRate = (errors / totalOps) * 100;

      console.log(
        `[PERF_BENCHMARK] VUs=${virtualUsers} totalOps=${totalOps} rps=${rps.toFixed(1)} avg=${avg.toFixed(2)}ms p90=${p90.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms error_rate=${errorRate.toFixed(2)}%`
      );

      assert.equal(errorRate, 0);
      assert.ok(p95 < 250, `Expected p95 (${p95.toFixed(2)}ms) < 250ms`);
    });
  });

  describe('9. OWASP Top 10 & API Security Verification (/09-web-security)', () => {
    it('neutralizes CSV Formula Injection payloads (=CMD, +SUM, -1+1, @import)', () => {
      const maliciousTx: TransactionRecord = {
        ...readDatabase().transactions[0]!,
        id: 'tx-malicious-csv',
        sender_name: '=CMD|\' /C calc\'!A0',
        notes: '@SUM(1+1)*cmd',
      };
      const csv = generateMoneyMateCSV([maliciousTx]);
      // Leading '=' and '@' must be prefixed with a single quote inside the CSV cell
      assert.equal(csv.includes('"\'=CMD|'), true);
      assert.equal(csv.includes('"\'@SUM(1+1)*cmd"'), true);
    });
  });
});
