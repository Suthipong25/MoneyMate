import type {
  AIExtractionPayload,
  DocumentRecord,
  TransactionRecord,
} from '@/types/domain';
import { normalizeAccountName } from '@/lib/utils/formatters';

// =============================================================================
// MoneyMate — 2-Tier Duplicate Detection Engine (Section 3.6)
// Tier 1: Exact SHA-256 File Hash per User
// Tier 2: Reference ID or (Transaction Date + Amount + Sender/Receiver + User ID)
// Near-matches that cannot be 100% confirmed are sent to Pending Review
// =============================================================================

export interface FileHashDuplicateCheck {
  isDuplicate: boolean;
  originalDocument: DocumentRecord | null;
}

export interface TransactionDuplicateCheck {
  outcome: 'unique' | 'exact_duplicate' | 'near_match_needs_review';
  duplicateOfTransactionId: string | null;
  originalTransaction: TransactionRecord | null;
  reason: string | null;
}

/**
 * Tier 1: Checks whether a file with the exact same SHA-256 hash was already uploaded by this user.
 */
export function checkTier1FileHashDuplicate(
  userId: string,
  fileHashSha256: string,
  existingDocuments: DocumentRecord[]
): FileHashDuplicateCheck {
  const match = existingDocuments.find(
    (doc) =>
      doc.user_id === userId &&
      doc.file_hash_sha256 === fileHashSha256 &&
      doc.status === 'completed'
  );

  return {
    isDuplicate: Boolean(match),
    originalDocument: match || null,
  };
}

/**
 * Tier 2: Checks extracted transaction details against existing user transactions.
 * - Exact Reference ID match -> 'exact_duplicate' (blocked from double counting, 0 credits charged)
 * - Exact Date + Amount + Time + Sender + Receiver match -> 'exact_duplicate'
 * - Same Date + Amount + Similar Sender/Receiver (without Ref ID or different time) -> 'near_match_needs_review'
 */
export function checkTier2TransactionDuplicate(
  userId: string,
  candidate: AIExtractionPayload,
  existingTransactions: TransactionRecord[]
): TransactionDuplicateCheck {
  const userTxs = existingTransactions.filter(
    (tx) =>
      tx.user_id === userId &&
      tx.status !== 'failed' &&
      tx.status !== 'duplicate'
  );

  const candRef = candidate.reference_id?.trim().toLowerCase();

  // 1. Check Reference ID exact match
  if (candRef && candRef.length >= 4) {
    const refMatch = userTxs.find(
      (tx) => tx.reference_id && tx.reference_id.trim().toLowerCase() === candRef
    );
    if (refMatch) {
      return {
        outcome: 'exact_duplicate',
        duplicateOfTransactionId: refMatch.id,
        originalTransaction: refMatch,
        reason: `พบรหัสอ้างอิงสลิปซ้ำ (${candidate.reference_id}) กับรายการเมื่อวันที่ ${refMatch.transaction_date || '-'}`,
      };
    }
  }

  // 2. Check Date + Amount + Sender/Receiver
  const candAmount = candidate.total_amount ?? candidate.amount;
  const candDate = candidate.transaction_date;

  if (candDate && candAmount !== null && candAmount > 0) {
    const normCandSender = normalizeAccountName(candidate.sender_name);
    const normCandReceiver = normalizeAccountName(
      candidate.receiver_name || candidate.merchant_name
    );

    for (const tx of userTxs) {
      const txAmount = Number(tx.total_amount || tx.amount);
      const sameDate = tx.transaction_date === candDate;
      const sameAmount = Math.abs(txAmount - candAmount) < 0.01;

      if (sameDate && sameAmount) {
        const normTxSender = normalizeAccountName(tx.sender_name);
        const normTxReceiver = normalizeAccountName(
          tx.receiver_name || tx.merchant_name
        );

        const senderMatches =
          normCandSender && normTxSender && normCandSender === normTxSender;
        const receiverMatches =
          normCandReceiver && normTxReceiver && normCandReceiver === normTxReceiver;

        const sameTime =
          Boolean(candidate.transaction_time) &&
          Boolean(tx.transaction_time) &&
          candidate.transaction_time!.slice(0, 5) === tx.transaction_time!.slice(0, 5);

        // If no conflicting reference IDs and date + time + amount + parties match -> exact duplicate
        if (
          !candRef &&
          !tx.reference_id &&
          sameTime &&
          (senderMatches || receiverMatches)
        ) {
          return {
            outcome: 'exact_duplicate',
            duplicateOfTransactionId: tx.id,
            originalTransaction: tx,
            reason: `พบรายการซ้ำ (วันที่ ${candDate} เวลา ${candidate.transaction_time} ยอดเงิน ${candAmount} บาท ตรงกันทุกประการ)`,
          };
        }

        // Near match: Same date and amount, and at least one party matches (or both blank)
        if (senderMatches || receiverMatches || (!normCandReceiver && !normTxReceiver)) {
          return {
            outcome: 'near_match_needs_review',
            duplicateOfTransactionId: tx.id,
            originalTransaction: tx,
            reason: `พบรายการที่มีวันที่ (${candDate}) และยอดเงิน (${candAmount.toFixed(2)} บาท) ใกล้เคียงกับรายการเดิม กรุณาตรวจสอบก่อนยืนยัน`,
          };
        }
      }
    }
  }

  return {
    outcome: 'unique',
    duplicateOfTransactionId: null,
    originalTransaction: null,
    reason: null,
  };
}
