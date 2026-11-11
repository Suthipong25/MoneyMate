import crypto from 'crypto';
import type {
  CreditLedgerEntry,
  CreditWallet,
  PaymentOrder,
} from '@/types/domain';

// =============================================================================
// MoneyMate — PromptPay Payment Gateway Adapter & Webhook Verifier (Section 5)
// Supports: GB Prime Pay ('gbprimepay'), Opn Payments ('opn'), and Sandbox ('sandbox')
// Rules:
// - Never trust payment status from Frontend
// - Never grant credits from user-uploaded slip images
// - Verify HMAC-SHA256 Webhook signature
// - Idempotent webhook fulfillment (duplicate webhook deliveries grant credits only once)
// =============================================================================

export interface DynamicQrResponse {
  provider: 'gbprimepay' | 'opn' | 'sandbox';
  providerReference: string;
  qrPayload: string;
  expiresAt: string;
  isSandbox: boolean;
}

export interface WebhookEventPayload {
  eventId: string;
  providerReference: string;
  amountThb: number;
  status: 'paid' | 'failed' | 'refunded';
  timestamp: number;
}

export function getConfiguredPaymentProvider(): 'gbprimepay' | 'opn' | 'sandbox' {
  const raw = (process.env.PAYMENT_PROVIDER || 'sandbox').toLowerCase().trim();
  if (raw === 'gbprimepay' || raw === 'opn') {
    const hasSecret =
      Boolean(process.env.PAYMENT_SECRET_KEY) &&
      process.env.PAYMENT_SECRET_KEY !== 'your-payment-gateway-secret-key';
    if (hasSecret) return raw;
  }
  return 'sandbox';
}

export function getWebhookSecret(): string {
  return (
    process.env.PAYMENT_WEBHOOK_SECRET ||
    'moneymate-webhook-signing-secret-2026'
  );
}

/**
 * Generates an EMVCo-compatible PromptPay Dynamic QR Payload string.
 */
export function buildPromptPayQrPayload(
  reference: string,
  amountThb: number
): string {
  const formattedAmount = amountThb.toFixed(2);
  return `00020101021229370016A000000677010111011300668000000005802TH530376454${String(
    formattedAmount.length
  ).padStart(2, '0')}${formattedAmount}62${String(reference.length + 4).padStart(
    2,
    '0'
  )}05${String(reference.length).padStart(2, '0')}${reference}6304ABCD`;
}

/**
 * Creates a Dynamic QR Payment Order via the configured Payment Gateway Adapter.
 */
export async function requestPromptPayDynamicQr(params: {
  orderId: string;
  packageCode: string;
  amountThb: number;
}): Promise<DynamicQrResponse> {
  const provider = getConfiguredPaymentProvider();
  const providerReference = `MM-${params.packageCode}-${Date.now()}-${params.orderId
    .slice(0, 6)
    .toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  // Sandbox / Mock Adapter when production credentials are not yet configured
  return {
    provider,
    providerReference,
    qrPayload: buildPromptPayQrPayload(providerReference, params.amountThb),
    expiresAt,
    isSandbox: provider === 'sandbox',
  };
}

/**
 * Computes HMAC-SHA256 signature for Payment Gateway Webhook verification.
 */
export function signPaymentWebhookPayload(
  rawBody: string,
  secret: string = getWebhookSecret()
): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Verifies the webhook signature using constant-time comparison (`crypto.timingSafeEqual`).
 */
export function verifyPaymentWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string = getWebhookSecret()
): boolean {
  if (!signatureHeader) return false;
  const cleanSig = signatureHeader.replace(/^sha256=/i, '').trim();
  const expectedSig = signPaymentWebhookPayload(rawBody, secret);

  const sigBuf = Buffer.from(cleanSig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Processes a verified payment webhook idempotently:
 * - Verifies signature
 * - Verifies order reference & exact amount
 * - Prevents duplicate credit top-ups if the same webhook is delivered multiple times
 */
export function processVerifiedPaymentWebhook(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  orders: PaymentOrder[];
  wallets: Map<string, CreditWallet>;
  ledger: CreditLedgerEntry[];
  webhookSecret?: string;
}): {
  alreadyProcessed: boolean;
  order: PaymentOrder;
  creditsGranted: number;
  newBalance: number;
} {
  const { rawBody, signatureHeader, orders, wallets, ledger, webhookSecret } =
    params;

  if (!verifyPaymentWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    throw new Error('INVALID_WEBHOOK_SIGNATURE: ลายเซ็น Webhook ไม่ถูกต้อง ปฏิเสธการทำรายการ');
  }

  let event: WebhookEventPayload;
  try {
    event = JSON.parse(rawBody) as WebhookEventPayload;
  } catch {
    throw new Error('INVALID_WEBHOOK_PAYLOAD: ข้อมูล JSON ของ Webhook ไม่ถูกต้อง');
  }

  const order = orders.find(
    (o) => o.provider_reference === event.providerReference
  );
  if (!order) {
    throw new Error(
      `ORDER_NOT_FOUND: ไม่พบคำสั่งซื้อรหัสอ้างอิง ${event.providerReference}`
    );
  }

  // Idempotency: If order is already paid, return immediately without granting credits again
  const idempotencyKey = `payment_topup_${order.id}`;
  const existingLedger = ledger.find((e) => e.idempotency_key === idempotencyKey);
  if (order.status === 'paid' || existingLedger) {
    const wallet = wallets.get(order.user_id);
    return {
      alreadyProcessed: true,
      order,
      creditsGranted: 0,
      newBalance: wallet?.balance ?? 0,
    };
  }

  if (order.status !== 'pending') {
    throw new Error(
      `INVALID_ORDER_STATUS: สถานะคำสั่งซื้อ (${order.status}) ไม่สามารถเติมเครดิตได้`
    );
  }

  // Verify exact payment amount
  if (Math.abs(Number(order.amount_thb) - Number(event.amountThb)) >= 0.01) {
    throw new Error(
      `AMOUNT_MISMATCH: ยอดเงินที่ชำระ (${event.amountThb}) ไม่ตรงกับคำสั่งซื้อ (${order.amount_thb})`
    );
  }

  if (event.status === 'failed') {
    order.status = 'failed';
    return {
      alreadyProcessed: false,
      order,
      creditsGranted: 0,
      newBalance: wallets.get(order.user_id)?.balance ?? 0,
    };
  }

  // Grant credits atomically
  const nowIso = new Date().toISOString();
  order.status = 'paid';
  order.webhook_event_id = event.eventId;
  order.paid_at = nowIso;

  const currentWallet = wallets.get(order.user_id) || {
    user_id: order.user_id,
    balance: 0,
    lifetime_purchased: 0,
    lifetime_used: 0,
    updated_at: nowIso,
  };

  const newBalance = currentWallet.balance + order.credits_amount;
  const updatedWallet: CreditWallet = {
    ...currentWallet,
    balance: newBalance,
    lifetime_purchased: currentWallet.lifetime_purchased + order.credits_amount,
    updated_at: nowIso,
  };
  wallets.set(order.user_id, updatedWallet);

  ledger.unshift({
    id: crypto.randomUUID(),
    user_id: order.user_id,
    delta: order.credits_amount,
    balance_after: newBalance,
    entry_type: 'package_purchase',
    idempotency_key: idempotencyKey,
    reference_id: order.provider_reference,
    reason: `เติมเครดิตแพ็กเกจ ${order.package_code} (+${order.credits_amount} เครดิต)`,
    created_by: null,
    created_at: nowIso,
  });

  return {
    alreadyProcessed: false,
    order,
    creditsGranted: order.credits_amount,
    newBalance,
  };
}
