import { NextResponse, type NextRequest } from 'next/server';
import { MoneyMateRepo } from '@/lib/supabase/repository';

// =============================================================================
// MoneyMate — Verified Payment Gateway Webhook Endpoint (Section 5 & 11.13)
// Rules:
// - Verifies HMAC-SHA256 signature from header `x-moneymate-signature` / `x-webhook-signature`
// - Verifies payment amount & provider_reference
// - Enforces idempotency: duplicate webhooks never grant credits twice
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-moneymate-signature') ||
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-gbprimepay-signature');

    const result = MoneyMateRepo.fulfillPaymentWebhook(rawBody, signature);

    return NextResponse.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      orderId: result.order.id,
      status: result.order.status,
      creditsGranted: result.creditsGranted,
      newBalance: result.newBalance,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Webhook verification failed';
    const isAuthError = message.includes('INVALID_WEBHOOK_SIGNATURE');
    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 401 : 400 }
    );
  }
}
