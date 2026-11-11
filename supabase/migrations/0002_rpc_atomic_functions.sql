-- =============================================================================
-- MoneyMate — Migration 0002: Atomic Credit Transactions, Webhook Top-up & Audit RPCs
-- Ensures zero double-deduction, zero double-topup, and mandatory audit logging
-- =============================================================================

-- 1. ATOMIC CREDIT DEDUCTION FOR COMPLETED NON-DUPLICATE AI JOB
CREATE OR REPLACE FUNCTION public.deduct_credit_for_job(
  p_user_id UUID,
  p_job_id UUID,
  p_document_id UUID,
  p_is_duplicate BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idem_key TEXT := 'job_deduct_' || p_job_id::text;
  v_already_deducted BOOLEAN;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Duplicate documents never deduct credit
  IF p_is_duplicate THEN
    RETURN jsonb_build_object(
      'deducted', FALSE,
      'reason', 'duplicate_document_free',
      'balance', (SELECT balance FROM public.credit_wallets WHERE user_id = p_user_id)
    );
  END IF;

  -- Check idempotency in credit_ledger (prevents double charge on retry)
  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger WHERE idempotency_key = v_idem_key
  ) INTO v_already_deducted;

  IF v_already_deducted THEN
    RETURN jsonb_build_object(
      'deducted', FALSE,
      'reason', 'already_deducted_for_job',
      'balance', (SELECT balance FROM public.credit_wallets WHERE user_id = p_user_id)
    );
  END IF;

  -- Lock wallet row for update
  SELECT balance INTO v_current_balance
  FROM public.credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < 1 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: เครดิตคงเหลือไม่เพียงพอสำหรับการประมวลผล';
  END IF;

  v_new_balance := v_current_balance - 1;

  UPDATE public.credit_wallets
  SET balance = v_new_balance,
      lifetime_used = lifetime_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_ledger (
    user_id, delta, balance_after, entry_type, idempotency_key, reference_id, reason
  ) VALUES (
    p_user_id, -1, v_new_balance, 'job_deduction', v_idem_key, p_document_id::text,
    'หักเครดิตประมวลผลเอกสารสำเร็จ (1 รูป = 1 เครดิต)'
  );

  UPDATE public.processing_jobs
  SET credit_deducted = TRUE, updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'deducted', TRUE,
    'reason', 'charged_one_credit',
    'balance', v_new_balance
  );
END;
$$;

-- 2. ATOMIC PAYMENT WEBHOOK FULFILLMENT (IDEMPOTENT TOP-UP)
CREATE OR REPLACE FUNCTION public.fulfill_payment_order_webhook(
  p_provider_reference TEXT,
  p_webhook_event_id TEXT,
  p_paid_amount_thb NUMERIC(10, 2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_new_balance INTEGER;
  v_idem_key TEXT;
BEGIN
  -- Lock the payment order row
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: ไม่พบคำสั่งซื้อรหัสอ้างอิง %', p_provider_reference;
  END IF;

  -- Idempotency check: if already paid, return success without granting duplicate credits
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object(
      'already_processed', TRUE,
      'order_id', v_order.id,
      'credits_granted', 0
    );
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'INVALID_ORDER_STATE: สถานะคำสั่งซื้อไม่สามารถเติมเครดิตได้ (%)', v_order.status;
  END IF;

  -- Verify exact amount matches
  IF v_order.amount_thb <> p_paid_amount_thb THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH: ยอดชำระ (%) ไม่ตรงกับคำสั่งซื้อ (%)', p_paid_amount_thb, v_order.amount_thb;
  END IF;

  v_idem_key := 'payment_topup_' || v_order.id::text;

  -- Update order status
  UPDATE public.payment_orders
  SET status = 'paid',
      webhook_event_id = p_webhook_event_id,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = v_order.id;

  -- Update user wallet
  UPDATE public.credit_wallets
  SET balance = balance + v_order.credits_amount,
      lifetime_purchased = lifetime_purchased + v_order.credits_amount,
      updated_at = NOW()
  WHERE user_id = v_order.user_id
  RETURNING balance INTO v_new_balance;

  -- Record ledger entry
  INSERT INTO public.credit_ledger (
    user_id, delta, balance_after, entry_type, idempotency_key, reference_id, reason
  ) VALUES (
    v_order.user_id,
    v_order.credits_amount,
    v_new_balance,
    'package_purchase',
    v_idem_key,
    v_order.provider_reference,
    'เติมเครดิตแพ็กเกจ ' || v_order.package_code || ' (' || v_order.credits_amount || ' เครดิต)'
  );

  -- Update subscription plan
  UPDATE public.subscriptions
  SET plan_code = v_order.package_code,
      last_package_purchased = v_order.package_code,
      status = 'active',
      updated_at = NOW()
  WHERE user_id = v_order.user_id;

  RETURN jsonb_build_object(
    'already_processed', FALSE,
    'order_id', v_order.id,
    'credits_granted', v_order.credits_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- 3. ADMIN CREDIT ADJUSTMENT WITH MANDATORY REASON & AUDIT LOG
CREATE OR REPLACE FUNCTION public.admin_adjust_user_credits(
  p_admin_id UUID,
  p_target_user_id UUID,
  p_delta INTEGER,
  p_reason TEXT,
  p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role user_role;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id AND status = 'active';
  IF v_admin_role <> 'super_admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: เฉพาะ Super Admin เท่านั้นที่สามารถปรับเครดิตได้';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'REASON_REQUIRED: กรุณาระบุเหตุผลในการปรับเครดิตอย่างน้อย 5 ตัวอักษร';
  END IF;

  SELECT balance INTO v_old_balance
  FROM public.credit_wallets
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF v_old_balance IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND: ไม่พบกระเป๋าเครดิตของผู้ใช้';
  END IF;

  v_new_balance := v_old_balance + p_delta;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_BALANCE: ยอดเครดิตคงเหลือหลังปรับต้องไม่ติดลบ';
  END IF;

  UPDATE public.credit_wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_target_user_id;

  INSERT INTO public.credit_ledger (
    user_id, delta, balance_after, entry_type, idempotency_key, reference_id, reason, created_by
  ) VALUES (
    p_target_user_id, p_delta, v_new_balance, 'admin_adjustment',
    'admin_adj_' || p_operation_id, p_admin_id::text, trim(p_reason), p_admin_id
  );

  INSERT INTO public.audit_logs (
    admin_id, target_user_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    p_admin_id, p_target_user_id, 'CREDIT_ADJUSTMENT', 'credit_wallets', p_target_user_id::text,
    trim(p_reason),
    jsonb_build_object('balance', v_old_balance),
    jsonb_build_object('balance', v_new_balance, 'delta', p_delta)
  );

  RETURN jsonb_build_object(
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'delta', p_delta
  );
END;
$$;
