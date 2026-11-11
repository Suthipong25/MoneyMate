import type {
  AIExtractionPayload,
  BusinessAccount,
  TransactionDirection,
} from '@/types/domain';
import { extractAccountDigits, normalizeAccountName } from '@/lib/utils/formatters';

// =============================================================================
// MoneyMate — Automatic Income / Expense / Internal Transfer Classifier
// Implements Section 3.4 & 3.5 using Business Profile + Document Context
// =============================================================================

export interface ClassificationOutcome {
  direction: TransactionDirection;
  categoryName: string;
  needsReview: boolean;
  reviewReason: string | null;
}

const DEFAULT_INCOME_CATEGORIES = [
  'รายได้จากการขาย',
  'รายได้จากบริการ',
  'รายได้อื่นๆ',
];

const DEFAULT_EXPENSE_CATEGORIES = [
  'ค่าอาหาร',
  'ค่าวัตถุดิบ',
  'ค่าขนส่ง',
  'ค่าโฆษณา',
  'ค่าสาธารณูปโภค',
  'ค่าเดินทาง',
  'ค่าอุปกรณ์',
  'ค่าเช่า',
  'ค่าใช้จ่ายอื่นๆ',
];

/**
 * Checks whether a name or account string on a document matches the user's business profile.
 */
export function matchesBusinessIdentity(
  candidateName: string | null | undefined,
  business: BusinessAccount | null | undefined
): boolean {
  if (!candidateName || !business) return false;
  const normCandidate = normalizeAccountName(candidateName);
  if (!normCandidate || normCandidate.length < 2) return false;

  const knownNames = [
    business.owner_name,
    business.business_name,
    ...(business.account_aliases || []),
  ]
    .map((n) => normalizeAccountName(n))
    .filter((n) => n.length >= 2);

  for (const known of knownNames) {
    if (normCandidate.includes(known) || known.includes(normCandidate)) {
      return true;
    }
  }

  // Also check trailing 4 digits of bank account if present in candidate string
  const candDigits = extractAccountDigits(candidateName);
  const bizDigits = extractAccountDigits(business.account_number);
  if (candDigits.length >= 4 && bizDigits.length >= 4) {
    const tailCand = candDigits.slice(-4);
    const tailBiz = bizDigits.slice(-4);
    if (tailCand === tailBiz) return true;
  }

  return false;
}

/**
 * Suggests an appropriate category based on direction and merchant/description keywords.
 */
export function inferCategoryFromContext(
  direction: TransactionDirection,
  extracted: Pick<
    AIExtractionPayload,
    'suggested_category' | 'merchant_name' | 'receiver_name' | 'description'
  >,
  business?: BusinessAccount | null
): string {
  const combinedText = [
    extracted.merchant_name,
    extracted.receiver_name,
    extracted.description,
    extracted.suggested_category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (direction === 'income') {
    if (
      extracted.suggested_category &&
      DEFAULT_INCOME_CATEGORIES.includes(extracted.suggested_category)
    ) {
      return extracted.suggested_category;
    }
    if (/บริการ|ที่ปรึกษา|ออกแบบ|รับจ้าง|ค่าแรง|service/i.test(combinedText)) {
      return 'รายได้จากบริการ';
    }
    return business?.default_income_category || 'รายได้จากการขาย';
  }

  if (direction === 'expense') {
    if (
      extracted.suggested_category &&
      DEFAULT_EXPENSE_CATEGORIES.includes(extracted.suggested_category)
    ) {
      return extracted.suggested_category;
    }
    if (/flash|kerry|j&t|ไปรษณีย์|ขนส่ง|ส่งพัสดุ|lalamove|grabexpress|dhl|ninjavan/i.test(combinedText)) {
      return 'ค่าขนส่ง';
    }
    if (/facebook|meta|google ads|tiktok|โฆษณา|ยิงแอด|boost/i.test(combinedText)) {
      return 'ค่าโฆษณา';
    }
    if (/การไฟฟ้า|ประปา|อินเทอร์เน็ต|ais|true|dtac|3bb|nt|ค่าไฟ|ค่าน้ำ|ค่าเน็ต/i.test(combinedText)) {
      return 'ค่าสาธารณูปโภค';
    }
    if (/อาหาร|กาแฟ|เครื่องดื่ม|cafe|restaurant|7-eleven|เซเว่น|ซูชิ|ข้าวมันไก่|lineman|grabfood/i.test(combinedText)) {
      return 'ค่าอาหาร';
    }
    if (/วัตถุดิบ|ซัพพลายเออร์|ตลาด|makro|แม็คโคร|แพ็คเกจจิ้ง|กล่องพัสดุ/i.test(combinedText)) {
      return 'ค่าวัตถุดิบ';
    }
    if (/น้ำมัน|ทางด่วน|ปตท|ptt|shell|bangchak|bts|mrt|แท็กซี่|เดินทาง/i.test(combinedText)) {
      return 'ค่าเดินทาง';
    }
    if (/ค่าเช่า|เช่าพื้นที่|เช่าร้าน|นิติบุคคล/i.test(combinedText)) {
      return 'ค่าเช่า';
    }
    if (/คอมพิวเตอร์|อุปกรณ์|เครื่องพิมพ์|กระดาษ|หมึก|office|advice|jib/i.test(combinedText)) {
      return 'ค่าอุปกรณ์';
    }
    return business?.default_expense_category || 'ค่าใช้จ่ายอื่นๆ';
  }

  return 'โอนระหว่างบัญชีตัวเอง';
}

/**
 * Context-aware classification combining Document Type + Business Profile + AI Confidence.
 * Never classifies solely on sender/receiver name without checking document context.
 */
export function classifyTransaction(
  extracted: AIExtractionPayload,
  business?: BusinessAccount | null
): ClassificationOutcome {
  // 1. Unknown document or missing critical amount/date -> Needs Review
  if (
    extracted.document_type === 'unknown' ||
    extracted.total_amount === null ||
    extracted.total_amount <= 0 ||
    !extracted.transaction_date
  ) {
    return {
      direction: 'needs_review',
      categoryName: 'ค่าใช้จ่ายอื่นๆ',
      needsReview: true,
      reviewReason:
        extracted.review_reason ||
        'ไม่สามารถระบุประเภทเอกสาร วันที่ หรือจำนวนเงินที่ชัดเจนได้ กรุณาตรวจสอบด้วยตนเอง',
    };
  }

  const isSenderOwner = matchesBusinessIdentity(extracted.sender_name, business);
  const isReceiverOwner = matchesBusinessIdentity(extracted.receiver_name, business);
  const isMerchantOwner = matchesBusinessIdentity(extracted.merchant_name, business);

  // 2. Internal transfer between user's own accounts
  if (isSenderOwner && isReceiverOwner) {
    return {
      direction: 'internal_transfer',
      categoryName: 'โอนระหว่างบัญชีตัวเอง',
      needsReview: false,
      reviewReason: null,
    };
  }

  // 3. Explicit Sales Receipt -> Income
  if (extracted.document_type === 'sales_receipt') {
    const categoryName = inferCategoryFromContext('income', extracted, business);
    return {
      direction: 'income',
      categoryName,
      needsReview: extracted.confidence < 0.75 || extracted.needs_review,
      reviewReason: extracted.review_reason,
    };
  }

  // 4. Explicit Purchase Receipt or Payment Receipt -> Expense
  if (
    extracted.document_type === 'purchase_receipt' ||
    extracted.document_type === 'payment_receipt'
  ) {
    const categoryName = inferCategoryFromContext('expense', extracted, business);
    return {
      direction: 'expense',
      categoryName,
      needsReview: extracted.confidence < 0.75 || extracted.needs_review,
      reviewReason: extracted.review_reason,
    };
  }

  // 5. Tax Invoice -> Check whether business is seller (merchant/receiver) or buyer
  if (extracted.document_type === 'tax_invoice') {
    if (isMerchantOwner || isReceiverOwner) {
      return {
        direction: 'income',
        categoryName: inferCategoryFromContext('income', extracted, business),
        needsReview: extracted.confidence < 0.75 || extracted.needs_review,
        reviewReason: extracted.review_reason,
      };
    }
    return {
      direction: 'expense',
      categoryName: inferCategoryFromContext('expense', extracted, business),
      needsReview: extracted.confidence < 0.75 || extracted.needs_review,
      reviewReason: extracted.review_reason,
    };
  }

  // 6. Bank Transfer Slip -> Context check with Business Profile
  if (extracted.document_type === 'bank_slip') {
    if (isReceiverOwner && !isSenderOwner) {
      return {
        direction: 'income',
        categoryName: inferCategoryFromContext('income', extracted, business),
        needsReview: extracted.confidence < 0.75 || extracted.needs_review,
        reviewReason: extracted.review_reason,
      };
    }
    if (isSenderOwner && !isReceiverOwner) {
      return {
        direction: 'expense',
        categoryName: inferCategoryFromContext('expense', extracted, business),
        needsReview: extracted.confidence < 0.75 || extracted.needs_review,
        reviewReason: extracted.review_reason,
      };
    }

    // If neither matches business profile, mark for review rather than guessing blindly
    return {
      direction: 'needs_review',
      categoryName: inferCategoryFromContext(extracted.direction, extracted, business),
      needsReview: true,
      reviewReason:
        extracted.review_reason ||
        'ชื่อผู้โอนและผู้รับในสลิปไม่ตรงกับบัญชีธุรกิจที่ตั้งค่าไว้ กรุณาตรวจสอบและยืนยันประเภทธุรกรรม',
    };
  }

  return {
    direction: 'needs_review',
    categoryName: 'ค่าใช้จ่ายอื่นๆ',
    needsReview: true,
    reviewReason: 'ไม่สามารถจำแนกทิศทางธุรกรรมได้โดยอัตโนมัติ กรุณาตรวจสอบ',
  };
}
