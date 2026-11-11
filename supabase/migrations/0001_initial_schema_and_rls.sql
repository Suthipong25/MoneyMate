-- =============================================================================
-- MoneyMate (เพื่อนช่วยจัดการเงิน) — Migration 0001: Initial Schema & RLS
-- Covers: profiles, business_accounts, categories, documents, processing_jobs,
--         transactions, credit_wallets, credit_ledger, credit_packages,
--         payment_orders, subscriptions, audit_logs
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMS & TYPES
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'super_admin', 'support', 'business_owner', 'business_member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_type_enum AS ENUM (
    'bank_slip',
    'payment_receipt',
    'purchase_receipt',
    'sales_receipt',
    'tax_invoice',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_direction AS ENUM (
    'income',
    'expense',
    'internal_transfer',
    'needs_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM (
    'processing',
    'pending_review',
    'confirmed',
    'duplicate',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- 2.1 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  status account_status NOT NULL DEFAULT 'active',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  data_retention_days INTEGER NOT NULL DEFAULT 365,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 2.2 business_accounts
CREATE TABLE IF NOT EXISTS public.business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_aliases TEXT[] NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'THB',
  default_income_category TEXT DEFAULT 'รายได้จากการขาย',
  default_expense_category TEXT DEFAULT 'ค่าใช้จ่ายอื่นๆ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_accounts_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_accounts_user ON public.business_accounts(user_id);

-- 2.3 categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  color_hex TEXT NOT NULL DEFAULT '#2563EB',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_dir ON public.categories(user_id, direction);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name_dir
  ON public.categories(COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name), direction);

-- 2.4 documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/jpg', 'image/webp')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  storage_path TEXT NOT NULL,
  file_hash_sha256 TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  is_duplicate_hash BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  retention_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_hash ON public.documents(user_id, file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_documents_batch ON public.documents(user_id, batch_id);

-- 2.5 processing_jobs
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  model_used TEXT,
  raw_ai_output JSONB,
  validated_output JSONB,
  error_code TEXT,
  error_message TEXT,
  credit_deducted BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_processing_jobs_document UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_status ON public.processing_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_batch ON public.processing_jobs(batch_id);

-- 2.6 transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  document_type document_type_enum NOT NULL DEFAULT 'unknown',
  transaction_date DATE,
  transaction_time TIME,
  sender_name TEXT,
  receiver_name TEXT,
  sender_bank TEXT,
  receiver_bank TEXT,
  merchant_name TEXT,
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  subtotal NUMERIC(15, 2),
  vat_amount NUMERIC(15, 2),
  tax_rate NUMERIC(5, 2),
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  vat_status TEXT NOT NULL DEFAULT 'unknown' CHECK (vat_status IN ('included', 'excluded', 'none', 'unknown')),
  direction transaction_direction NOT NULL DEFAULT 'needs_review',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT 'ค่าใช้จ่ายอื่นๆ',
  reference_id TEXT,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_reason TEXT,
  status transaction_status NOT NULL DEFAULT 'pending_review',
  duplicate_of_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_direction ON public.transactions(user_id, direction);
CREATE INDEX IF NOT EXISTS idx_transactions_user_ref ON public.transactions(user_id, reference_id) WHERE reference_id IS NOT NULL;

-- Unique constraint preventing duplicate confirmed/pending transactions with identical reference_id per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_user_active_ref
  ON public.transactions(user_id, reference_id)
  WHERE reference_id IS NOT NULL AND status IN ('confirmed', 'pending_review');

-- 2.7 credit_wallets
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 5 CHECK (balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_credit_wallets_user UNIQUE (user_id)
);

-- 2.8 credit_ledger
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('initial_free', 'job_deduction', 'package_purchase', 'admin_adjustment', 'refund_deduction')),
  idempotency_key TEXT NOT NULL,
  reference_id TEXT,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_credit_ledger_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON public.credit_ledger(user_id, created_at DESC);

-- 2.9 credit_packages
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_thb NUMERIC(10, 2) NOT NULL CHECK (price_thb >= 0),
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 payment_orders
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  package_code TEXT NOT NULL,
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  amount_thb NUMERIC(10, 2) NOT NULL CHECK (amount_thb > 0),
  currency TEXT NOT NULL DEFAULT 'THB',
  provider TEXT NOT NULL CHECK (provider IN ('gbprimepay', 'opn', 'sandbox')),
  provider_reference TEXT NOT NULL UNIQUE,
  qr_payload TEXT,
  qr_image_url TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  webhook_event_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);

-- 2.11 subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'FREE',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  last_package_purchased TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subscriptions_user UNIQUE (user_id)
);

-- 2.12 audit_logs (Immutable Admin Action Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 5),
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_user_id, created_at DESC);

-- =============================================================================
-- 3. PREVENT UNAUTHORIZED ROLE / STATUS SELF-ESCALATION TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only service_role (or postgres superuser) may alter role, status, or mfa_enabled
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Forbidden: Users cannot modify their own role';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Forbidden: Users cannot modify their own account status';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_no_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_no_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- =============================================================================
-- 4. AUTO-PROVISION PROFILE, WALLET (5 FREE CREDITS) & SUBSCRIPTION ON SIGNUP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    'customer',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_wallets (user_id, balance, lifetime_purchased, lifetime_used)
  VALUES (NEW.id, 5, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (user_id, delta, balance_after, entry_type, idempotency_key, reason)
  VALUES (NEW.id, 5, 5, 'initial_free', 'signup_free_' || NEW.id::text, 'เครดิตทดลองใช้งานฟรีสำหรับสมาชิกใหม่ 5 รูป')
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan_code, status)
  VALUES (NEW.id, 'FREE', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES FOR ALL 12 TABLES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an active super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;

-- 5.1 profiles policies
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_super_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 5.2 business_accounts policies
CREATE POLICY "business_accounts_select_own" ON public.business_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "business_accounts_insert_own" ON public.business_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_accounts_update_own" ON public.business_accounts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_accounts_delete_own" ON public.business_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- 5.3 categories policies (Users see system defaults + their own custom categories)
CREATE POLICY "categories_select_default_or_own" ON public.categories
  FOR SELECT USING (is_default = TRUE OR auth.uid() = user_id OR public.is_super_admin());

CREATE POLICY "categories_insert_own" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_default = FALSE);

CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id AND is_default = FALSE)
  WITH CHECK (auth.uid() = user_id AND is_default = FALSE);

CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE USING (auth.uid() = user_id AND is_default = FALSE);

-- 5.4 documents policies (Strict isolation: only document owner)
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- 5.5 processing_jobs policies
CREATE POLICY "processing_jobs_select_own_or_admin" ON public.processing_jobs
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

-- 5.6 transactions policies (Strict isolation: only transaction owner)
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- 5.7 credit_wallets policies (Read-only for user; mutations via atomic RPC only)
CREATE POLICY "credit_wallets_select_own_or_admin" ON public.credit_wallets
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

-- 5.8 credit_ledger policies (Read-only for user)
CREATE POLICY "credit_ledger_select_own_or_admin" ON public.credit_ledger
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

-- 5.9 credit_packages policies (Publicly readable active packages; admin manages all)
CREATE POLICY "credit_packages_select_all" ON public.credit_packages
  FOR SELECT USING (is_active = TRUE OR public.is_super_admin());

-- 5.10 payment_orders policies
CREATE POLICY "payment_orders_select_own_or_admin" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

-- 5.11 subscriptions policies
CREATE POLICY "subscriptions_select_own_or_admin" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

-- 5.12 audit_logs policies (Super admin read-only; inserts via server RPC)
CREATE POLICY "audit_logs_select_admin_only" ON public.audit_logs
  FOR SELECT USING (public.is_super_admin());
