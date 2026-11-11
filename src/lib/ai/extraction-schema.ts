import { z } from 'zod';

// =============================================================================
// MoneyMate — Strict Zod Validation Schema for AI Document Extraction
// Enforces Section 3.3 & Section 3.9 (VAT rules & no hallucinated values)
// =============================================================================

export const DocumentTypeSchema = z.enum([
  'bank_slip',
  'payment_receipt',
  'purchase_receipt',
  'sales_receipt',
  'tax_invoice',
  'unknown',
]);

export const TransactionDirectionSchema = z.enum([
  'income',
  'expense',
  'internal_transfer',
  'needs_review',
]);

export const IsoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const TimeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const AIExtractionSchema = z.object({
  document_type: DocumentTypeSchema.catch('unknown'),
  transaction_date: z
    .string()
    .regex(IsoDateRegex, 'Must be ISO date YYYY-MM-DD')
    .nullable()
    .catch(null),
  transaction_time: z
    .string()
    .regex(TimeRegex, 'Must be HH:mm:ss or HH:mm')
    .nullable()
    .catch(null),
  sender_name: z.string().trim().min(1).nullable().catch(null),
  receiver_name: z.string().trim().min(1).nullable().catch(null),
  sender_bank: z.string().trim().min(1).nullable().catch(null),
  receiver_bank: z.string().trim().min(1).nullable().catch(null),
  amount: z.number().nonnegative().nullable().catch(null),
  reference_id: z.string().trim().min(1).nullable().catch(null),
  merchant_name: z.string().trim().min(1).nullable().catch(null),
  description: z.string().trim().min(1).nullable().catch(null),
  subtotal: z.number().nonnegative().nullable().catch(null),
  vat_amount: z.number().nonnegative().nullable().catch(null),
  tax_rate: z.number().min(0).max(100).nullable().catch(null),
  total_amount: z.number().nonnegative().nullable().catch(null),
  suggested_category: z.string().trim().min(1).nullable().catch(null),
  direction: TransactionDirectionSchema.catch('needs_review'),
  confidence: z.number().min(0).max(1).catch(0),
  needs_review: z.boolean().catch(true),
  review_reason: z.string().nullable().catch(null),
});

export type ValidatedAIExtraction = z.infer<typeof AIExtractionSchema>;

/**
 * Determines VAT status strictly from extracted document fields without inventing VAT numbers.
 * Rule 3.9: Never compute VAT on our own if the source document does not explicitly show it.
 */
export function resolveVatStatus(payload: {
  document_type: string;
  subtotal: number | null;
  vat_amount: number | null;
  tax_rate: number | null;
  total_amount: number | null;
}): 'included' | 'excluded' | 'none' | 'unknown' {
  if (payload.document_type === 'bank_slip') {
    return 'none';
  }
  const hasVat = payload.vat_amount !== null && payload.vat_amount > 0;
  const hasSubtotal = payload.subtotal !== null && payload.subtotal > 0;
  const hasTotal = payload.total_amount !== null && payload.total_amount > 0;

  if (hasVat && hasSubtotal && hasTotal) {
    const diff = Math.abs(payload.subtotal! + payload.vat_amount! - payload.total_amount!);
    if (diff <= 1.0) {
      return 'included';
    }
    return 'excluded';
  }

  if (payload.vat_amount === 0 || payload.tax_rate === 0) {
    return 'none';
  }

  return 'unknown';
}
