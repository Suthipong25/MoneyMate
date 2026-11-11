// =============================================================================
// MoneyMate (เพื่อนช่วยจัดการเงิน) — Core Domain Types & Schemas
// Clean, strongly-typed contracts shared across Server, Database, and UI
// =============================================================================

export type UserRole =
  | 'customer'
  | 'super_admin'
  | 'support'
  | 'business_owner'
  | 'business_member';

export type AccountStatus = 'active' | 'suspended';

export type DocumentType =
  | 'bank_slip'
  | 'payment_receipt'
  | 'purchase_receipt'
  | 'sales_receipt'
  | 'tax_invoice'
  | 'unknown';

export type TransactionDirection =
  | 'income'
  | 'expense'
  | 'internal_transfer'
  | 'needs_review';

export type TransactionStatus =
  | 'processing'
  | 'pending_review'
  | 'confirmed'
  | 'duplicate'
  | 'failed';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type VatStatus = 'included' | 'excluded' | 'none' | 'unknown';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: AccountStatus;
  mfa_enabled: boolean;
  mfa_verified?: boolean;
  data_retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessAccount {
  id: string;
  user_id: string;
  owner_name: string;
  business_name: string;
  bank_name: string;
  account_number: string;
  account_aliases: string[];
  currency: string;
  default_income_category: string;
  default_expense_category: string;
  updated_at: string;
}

export interface CategoryItem {
  id: string;
  user_id: string | null;
  name: string;
  direction: 'income' | 'expense';
  color_hex: string;
  is_default: boolean;
  is_active: boolean;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  batch_id: string;
  file_name: string;
  mime_type: 'image/png' | 'image/jpeg' | 'image/jpg' | 'image/webp';
  file_size_bytes: number;
  storage_path: string;
  file_hash_sha256: string;
  status: JobStatus;
  is_duplicate_hash: boolean;
  duplicate_of_document_id: string | null;
  preview_data_url?: string;
  created_at: string;
}

export interface AIExtractionPayload {
  document_type: DocumentType;
  transaction_date: string | null;
  transaction_time: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  sender_bank: string | null;
  receiver_bank: string | null;
  amount: number | null;
  reference_id: string | null;
  merchant_name: string | null;
  description: string | null;
  subtotal: number | null;
  vat_amount: number | null;
  tax_rate: number | null;
  total_amount: number | null;
  suggested_category: string | null;
  direction: TransactionDirection;
  confidence: number;
  needs_review: boolean;
  review_reason: string | null;
}

export interface ProcessingJob {
  id: string;
  user_id: string;
  document_id: string;
  file_name?: string;
  batch_id: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  model_used: string | null;
  raw_ai_output: Record<string, unknown> | null;
  validated_output: AIExtractionPayload | null;
  error_code: string | null;
  error_message: string | null;
  credit_deducted: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  document_id: string | null;
  job_id: string | null;
  document_type: DocumentType;
  transaction_date: string | null;
  transaction_time: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  sender_bank: string | null;
  receiver_bank: string | null;
  merchant_name: string | null;
  description: string | null;
  amount: number;
  subtotal: number | null;
  vat_amount: number | null;
  tax_rate: number | null;
  total_amount: number;
  vat_status: VatStatus;
  direction: TransactionDirection;
  category_id: string | null;
  category_name: string;
  reference_id: string | null;
  confidence: number;
  needs_review: boolean;
  review_reason: string | null;
  status: TransactionStatus;
  duplicate_of_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditWallet {
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  updated_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  entry_type:
    | 'initial_free'
    | 'job_deduction'
    | 'package_purchase'
    | 'admin_adjustment'
    | 'refund_deduction';
  idempotency_key: string;
  reference_id: string | null;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface CreditPackage {
  id: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  price_thb: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface PaymentOrder {
  id: string;
  user_id: string;
  package_id: string;
  package_code: string;
  credits_amount: number;
  amount_thb: number;
  currency: string;
  provider: 'gbprimepay' | 'opn' | 'sandbox';
  provider_reference: string;
  qr_payload: string;
  qr_image_url?: string;
  status: PaymentStatus;
  webhook_event_id: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  expires_at: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_email?: string;
  target_user_id: string | null;
  target_user_email?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  net_amount: number;
  confirmed_count: number;
  pending_review_count: number;
  duplicate_count: number;
  failed_count: number;
  internal_transfer_count: number;
  daily_series: Array<{ date: string; label: string; income: number; expense: number }>;
  monthly_series: Array<{ month: string; label: string; income: number; expense: number }>;
  expense_by_category: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
    color_hex: string;
  }>;
  top_expense_categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  vat_summary: {
    included_count: number;
    excluded_count: number;
    none_count: number;
    unknown_count: number;
    income_vat_total: number;
    expense_vat_total: number;
  };
  recent_transactions: TransactionRecord[];
  disclaimer: string;
}
