import type {
  CategoryItem,
  DashboardSummary,
  TransactionRecord,
} from '@/types/domain';
import { formatThaiDate } from '@/lib/utils/formatters';

// =============================================================================
// MoneyMate — Financial Dashboard Calculation Engine (Section 3.8 & 3.9)
// Formula: Net Amount = Total Income - Total Expense
// STRICT RULE: Computes ONLY from status === 'confirmed' transactions.
// Excludes: 'duplicate', 'failed', 'pending_review', and direction === 'internal_transfer'.
// =============================================================================

export const FINANCIAL_DISCLAIMER =
  'หมายเหตุ: ยอดสุทธิเป็นการคำนวณจากรายการที่บันทึกและยืนยันแล้วในระบบ ไม่ใช่การรับรองกำไรทางบัญชีหรือภาษี';

const CATEGORY_COLORS: Record<string, string> = {
  รายได้จากการขาย: '#0284C7',
  รายได้จากบริการ: '#1E40AF',
  รายได้อื่นๆ: '#38BDF8',
  ค่าอาหาร: '#DC2626',
  ค่าวัตถุดิบ: '#E11D48',
  ค่าขนส่ง: '#0284C7',
  ค่าโฆษณา: '#1E40AF',
  ค่าสาธารณูปโภค: '#0369A1',
  ค่าเดินทาง: '#38BDF8',
  ค่าอุปกรณ์: '#2563EB',
  ค่าเช่า: '#BE123C',
  ค่าใช้จ่ายอื่นๆ: '#476282',
};

export interface DateRangeFilter {
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null;   // YYYY-MM-DD
}

export function filterTransactionsByDateRange(
  transactions: TransactionRecord[],
  range?: DateRangeFilter
): TransactionRecord[] {
  if (!range || (!range.startDate && !range.endDate)) {
    return transactions;
  }
  return transactions.filter((tx) => {
    const dateKey = tx.transaction_date || tx.created_at.slice(0, 10);
    if (range.startDate && dateKey < range.startDate) return false;
    if (range.endDate && dateKey > range.endDate) return false;
    return true;
  });
}

export function calculateDashboardSummary(
  allTransactions: TransactionRecord[],
  range?: DateRangeFilter,
  categories?: CategoryItem[]
): DashboardSummary {
  const scoped = filterTransactionsByDateRange(allTransactions, range);

  let totalIncome = 0;
  let totalExpense = 0;
  let confirmedCount = 0;
  let pendingReviewCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  let internalTransferCount = 0;

  const dailyMap = new Map<string, { income: number; expense: number }>();
  const monthlyMap = new Map<string, { income: number; expense: number }>();
  const expenseCatMap = new Map<string, { amount: number; count: number }>();

  const vatSummary = {
    included_count: 0,
    excluded_count: 0,
    none_count: 0,
    unknown_count: 0,
    income_vat_total: 0,
    expense_vat_total: 0,
  };

  for (const tx of scoped) {
    if (tx.status === 'pending_review') pendingReviewCount++;
    if (tx.status === 'duplicate') duplicateCount++;
    if (tx.status === 'failed') failedCount++;
    if (tx.direction === 'internal_transfer') internalTransferCount++;

    // STRICT EXCLUSION RULE (Section 3.8):
    // Only include status === 'confirmed' AND direction in ('income', 'expense')
    if (tx.status !== 'confirmed') continue;
    if (
      tx.direction === 'internal_transfer' ||
      tx.direction === 'needs_review'
    ) {
      continue;
    }

    const amount = Number(tx.total_amount ?? tx.amount ?? 0);
    if (Number.isNaN(amount) || amount <= 0) continue;

    confirmedCount++;

    // VAT tracking on confirmed transactions
    if (tx.vat_status === 'included') vatSummary.included_count++;
    else if (tx.vat_status === 'excluded') vatSummary.excluded_count++;
    else if (tx.vat_status === 'none') vatSummary.none_count++;
    else vatSummary.unknown_count++;

    const vatVal = tx.vat_amount !== null && !Number.isNaN(Number(tx.vat_amount))
      ? Number(tx.vat_amount)
      : 0;

    const dateKey = tx.transaction_date || tx.created_at.slice(0, 10);
    const monthKey = dateKey.slice(0, 7); // YYYY-MM

    const dayEntry = dailyMap.get(dateKey) || { income: 0, expense: 0 };
    const monthEntry = monthlyMap.get(monthKey) || { income: 0, expense: 0 };

    if (tx.direction === 'income') {
      totalIncome += amount;
      dayEntry.income += amount;
      monthEntry.income += amount;
      vatSummary.income_vat_total += vatVal;
    } else if (tx.direction === 'expense') {
      totalExpense += amount;
      dayEntry.expense += amount;
      monthEntry.expense += amount;
      vatSummary.expense_vat_total += vatVal;

      const catName = tx.category_name || 'ค่าใช้จ่ายอื่นๆ';
      const catEntry = expenseCatMap.get(catName) || { amount: 0, count: 0 };
      catEntry.amount += amount;
      catEntry.count += 1;
      expenseCatMap.set(catName, catEntry);
    }

    dailyMap.set(dateKey, dayEntry);
    monthlyMap.set(monthKey, monthEntry);
  }

  totalIncome = Number(totalIncome.toFixed(2));
  totalExpense = Number(totalExpense.toFixed(2));
  const netAmount = Number((totalIncome - totalExpense).toFixed(2));
  vatSummary.income_vat_total = Number(vatSummary.income_vat_total.toFixed(2));
  vatSummary.expense_vat_total = Number(vatSummary.expense_vat_total.toFixed(2));

  const dailySeries = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      label: formatThaiDate(date),
      income: Number(vals.income.toFixed(2)),
      expense: Number(vals.expense.toFixed(2)),
    }));

  const monthlySeries = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month,
      label: month,
      income: Number(vals.income.toFixed(2)),
      expense: Number(vals.expense.toFixed(2)),
    }));

  const catColorLookup = new Map<string, string>();
  if (categories) {
    for (const c of categories) {
      catColorLookup.set(c.name, c.color_hex);
    }
  }

  const expenseByCategory = Array.from(expenseCatMap.entries())
    .map(([category, data]) => {
      const amount = Number(data.amount.toFixed(2));
      const percentage =
        totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(1)) : 0;
      const colorHex =
        catColorLookup.get(category) ||
        CATEGORY_COLORS[category] ||
        '#64748B';
      return {
        category,
        amount,
        percentage,
        count: data.count,
        color_hex: colorHex,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const topExpenseCategories = expenseByCategory.slice(0, 5).map((item) => ({
    category: item.category,
    amount: item.amount,
    percentage: item.percentage,
  }));

  const recentTransactions = [...scoped]
    .sort((a, b) => {
      const dateA = a.transaction_date || a.created_at;
      const dateB = b.transaction_date || b.created_at;
      return dateB.localeCompare(dateA);
    })
    .slice(0, 10);

  return {
    total_income: totalIncome,
    total_expense: totalExpense,
    net_amount: netAmount,
    confirmed_count: confirmedCount,
    pending_review_count: pendingReviewCount,
    duplicate_count: duplicateCount,
    failed_count: failedCount,
    internal_transfer_count: internalTransferCount,
    daily_series: dailySeries,
    monthly_series: monthlySeries,
    expense_by_category: expenseByCategory,
    top_expense_categories: topExpenseCategories,
    vat_summary: vatSummary,
    recent_transactions: recentTransactions,
    disclaimer: FINANCIAL_DISCLAIMER,
  };
}
