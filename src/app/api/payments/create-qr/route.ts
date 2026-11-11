import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCustomerSession } from '@/lib/security/auth-session';
import {
  MoneyMateRepo,
  readDatabase,
  writeDatabase,
} from '@/lib/supabase/repository';
import {
  requestPromptPayDynamicQr,
  signPaymentWebhookPayload,
} from '@/lib/payments/adapter';
import type { PaymentOrder } from '@/types/domain';

const CreatePaymentOrderSchema = z.object({
  packageCode: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireCustomerSession(true);
    const wallet = MoneyMateRepo.getWalletForUser(user.id);
    const ledger = MoneyMateRepo.getLedgerForUser(user.id);
    const packages = MoneyMateRepo.getPackages(false);
    const orders = MoneyMateRepo.getPaymentOrdersForUser(user.id);

    return NextResponse.json({
      wallet,
      ledger,
      packages,
      orders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลเครดิตได้' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const body = await request.json();

    // Sandbox test helper: fires a signed server-to-server webhook simulation
    if (body.action === 'trigger_sandbox_webhook') {
      const orderId = String(body.orderId || '');
      const db = readDatabase();
      const order = db.payment_orders.find(
        (o) => o.id === orderId && o.user_id === user.id
      );
      if (!order) {
        return NextResponse.json(
          { error: 'ไม่พบคำสั่งซื้อที่ต้องการจำลอง Webhook' },
          { status: 404 }
        );
      }

      const webhookPayload = JSON.stringify({
        eventId: `evt_${crypto.randomUUID()}`,
        providerReference: order.provider_reference,
        amountThb: order.amount_thb,
        status: 'paid',
        timestamp: Date.now(),
      });
      const signature = signPaymentWebhookPayload(webhookPayload);
      const result = MoneyMateRepo.fulfillPaymentWebhook(
        webhookPayload,
        signature
      );

      return NextResponse.json({
        ok: true,
        ...result,
        message: result.alreadyProcessed
          ? 'คำสั่งซื้อนี้ได้รับการยืนยันและเติมเครดิตไปก่อนหน้าแล้ว (Idempotent Webhook)'
          : `ชำระเงินสำเร็จ! เติมเครดิต +${result.creditsGranted} เครดิตเข้ากระเป๋าเรียบร้อยแล้ว`,
      });
    }

    const parsed = CreatePaymentOrderSchema.parse(body);
    const packages = MoneyMateRepo.getPackages(false);
    const pkg = packages.find(
      (p) => p.code.toUpperCase() === parsed.packageCode.toUpperCase()
    );

    if (!pkg || pkg.price_thb <= 0) {
      return NextResponse.json(
        { error: 'ไม่พบแพ็กเกจเครดิตที่เลือก หรือแพ็กเกจไม่รองรับการชำระเงิน' },
        { status: 400 }
      );
    }

    const orderId = crypto.randomUUID();
    const qrRes = await requestPromptPayDynamicQr({
      orderId,
      packageCode: pkg.code,
      amountThb: pkg.price_thb,
    });

    const newOrder: PaymentOrder = {
      id: orderId,
      user_id: user.id,
      package_id: pkg.id,
      package_code: pkg.code,
      credits_amount: pkg.credits,
      amount_thb: pkg.price_thb,
      currency: 'THB',
      provider: qrRes.provider,
      provider_reference: qrRes.providerReference,
      qr_payload: qrRes.qrPayload,
      status: 'pending',
      webhook_event_id: null,
      paid_at: null,
      refunded_at: null,
      refund_reason: null,
      expires_at: qrRes.expiresAt,
      created_at: new Date().toISOString(),
    };

    const db = readDatabase();
    db.payment_orders.unshift(newOrder);
    writeDatabase(db);

    return NextResponse.json({
      ok: true,
      order: newOrder,
      isSandbox: qrRes.isSandbox,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'ไม่สามารถสร้างรายการชำระเงินได้',
      },
      { status: 400 }
    );
  }
}
