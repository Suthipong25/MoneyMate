import ExcelJS from 'exceljs';
import type { CategoryItem, TransactionRecord } from '@/types/domain';
import {
  calculateDashboardSummary,
  filterTransactionsByDateRange,
  type DateRangeFilter,
  FINANCIAL_DISCLAIMER,
} from '@/lib/analytics/dashboard-calc';

// =============================================================================
// MoneyMate — 5-Sheet Excel (.xlsx) & UTF-8 CSV Export Engine (Section 3.10)
// Sheets: 1. Summary, 2. Income, 3. Expense, 4. Transactions, 5. Categories
// Includes: Header styling, Currency format, Date format, Column widths,
//           AutoFilter, and native Excel formulas (=B3-B4, SUM)
// =============================================================================

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E40AF' }, // MoneyMate Brand Deep Blue
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const CURRENCY_NUMFMT = '"฿"#,##0.00;("฿"#,##0.00);"฿"0.00';
const DATE_NUMFMT = 'dd/mm/yyyy';

function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  for (let col = 1; col <= columnCount; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
}

function toExcelDate(dateStr: string | null | undefined): Date | string {
  if (!dateStr) return '-';
  const parsed = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? dateStr : parsed;
}

export async function generateMoneyMateExcelBuffer(
  allTransactions: TransactionRecord[],
  range?: DateRangeFilter,
  categories?: CategoryItem[]
): Promise<Buffer> {
  const summary = calculateDashboardSummary(allTransactions, range, categories);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MoneyMate (เพื่อนช่วยจัดการเงิน)';
  workbook.created = new Date();

  const scopedTxs = filterTransactionsByDateRange(allTransactions, range);

  const confirmedIncome = scopedTxs.filter(
    (tx) => tx.status === 'confirmed' && tx.direction === 'income'
  );
  const confirmedExpense = scopedTxs.filter(
    (tx) => tx.status === 'confirmed' && tx.direction === 'expense'
  );

  // ===========================================================================
  // SHEET 1: Summary
  // ===========================================================================
  const sheetSummary = workbook.addWorksheet('Summary');
  sheetSummary.columns = [
    { header: 'รายการสรุปงบการเงิน (MoneyMate)', key: 'metric', width: 42 },
    { header: 'จำนวนเงิน (บาท)', key: 'value', width: 25 },
    { header: 'หมายเหตุ', key: 'note', width: 48 },
  ];
  styleHeaderRow(sheetSummary, 3);

  // Row 2: Date Range Info
  sheetSummary.addRow({
    metric: 'ช่วงวันที่รายงาน',
    value:
      range?.startDate || range?.endDate
        ? `${range?.startDate || 'เริ่มต้น'} ถึง ${range?.endDate || 'ปัจจุบัน'}`
        : 'ทั้งหมด',
    note: `จำนวนรายการที่ยืนยันแล้ว ${summary.confirmed_count} รายการ`,
  });

  // Row 3: Total Income
  const incomeRow = sheetSummary.addRow({
    metric: 'Total Income (รายรับรวมที่ยืนยันแล้ว)',
    value: summary.total_income,
    note: 'คำนวณเฉพาะสถานะ Confirmed',
  });
  incomeRow.getCell(2).numFmt = CURRENCY_NUMFMT;
  incomeRow.getCell(2).font = { bold: true, color: { argb: 'FF15803D' } };

  // Row 4: Total Expense
  const expenseRow = sheetSummary.addRow({
    metric: 'Total Expense (รายจ่ายรวมที่ยืนยันแล้ว)',
    value: summary.total_expense,
    note: 'คำนวณเฉพาะสถานะ Confirmed',
  });
  expenseRow.getCell(2).numFmt = CURRENCY_NUMFMT;
  expenseRow.getCell(2).font = { bold: true, color: { argb: 'FFDC2626' } };

  // Row 5: Net Amount with Formula (=B3-B4)
  const netRow = sheetSummary.addRow({
    metric: 'Net Amount (ยอดคงเหลือสุทธิ = รายรับ - รายจ่าย)',
    value: { formula: 'B3-B4', result: summary.net_amount },
    note: FINANCIAL_DISCLAIMER,
  });
  netRow.getCell(1).font = { bold: true };
  netRow.getCell(2).numFmt = CURRENCY_NUMFMT;
  netRow.getCell(2).font = { bold: true, color: { argb: 'FF1E40AF' } };

  sheetSummary.autoFilter = 'A1:C5';

  // ===========================================================================
  // SHEET 2: Income
  // ===========================================================================
  const sheetIncome = workbook.addWorksheet('Income');
  sheetIncome.columns = [
    { header: 'วันที่', key: 'date', width: 15 },
    { header: 'เวลา', key: 'time', width: 12 },
    { header: 'หมวดหมู่', key: 'category', width: 22 },
    { header: 'ผู้โอน / ลูกค้า', key: 'sender', width: 26 },
    { header: 'ผู้รับ', key: 'receiver', width: 26 },
    { header: 'ธนาคาร', key: 'bank', width: 18 },
    { header: 'ยอดก่อน VAT', key: 'subtotal', width: 16 },
    { header: 'VAT', key: 'vat', width: 14 },
    { header: 'จำนวนเงินสุทธิ (฿)', key: 'total', width: 18 },
    { header: 'Reference ID', key: 'ref', width: 22 },
    { header: 'หมายเหตุ', key: 'notes', width: 28 },
  ];
  styleHeaderRow(sheetIncome, 11);

  for (const tx of confirmedIncome) {
    const row = sheetIncome.addRow({
      date: toExcelDate(tx.transaction_date),
      time: tx.transaction_time || '-',
      category: tx.category_name,
      sender: tx.sender_name || '-',
      receiver: tx.receiver_name || tx.merchant_name || '-',
      bank: tx.receiver_bank || tx.sender_bank || '-',
      subtotal: tx.subtotal ?? null,
      vat: tx.vat_amount ?? null,
      total: Number(tx.total_amount ?? tx.amount ?? 0),
      ref: tx.reference_id || '-',
      notes: tx.notes || tx.description || '',
    });
    row.getCell(1).numFmt = DATE_NUMFMT;
    if (tx.subtotal !== null) row.getCell(7).numFmt = CURRENCY_NUMFMT;
    if (tx.vat_amount !== null) row.getCell(8).numFmt = CURRENCY_NUMFMT;
    row.getCell(9).numFmt = CURRENCY_NUMFMT;
  }

  const incomeLastDataRow = Math.max(2, confirmedIncome.length + 1);
  const incomeSumRow = sheetIncome.addRow({
    date: 'รวมรายรับทั้งหมด',
    total: {
      formula: confirmedIncome.length > 0 ? `SUM(I2:I${incomeLastDataRow})` : '0',
      result: summary.total_income,
    },
  });
  incomeSumRow.font = { bold: true };
  incomeSumRow.getCell(9).numFmt = CURRENCY_NUMFMT;
  sheetIncome.autoFilter = `A1:K${incomeLastDataRow}`;

  // ===========================================================================
  // SHEET 3: Expense
  // ===========================================================================
  const sheetExpense = workbook.addWorksheet('Expense');
  sheetExpense.columns = [
    { header: 'วันที่', key: 'date', width: 15 },
    { header: 'เวลา', key: 'time', width: 12 },
    { header: 'หมวดหมู่', key: 'category', width: 22 },
    { header: 'ผู้รับเงิน / ร้านค้า', key: 'receiver', width: 28 },
    { header: 'ผู้โอน', key: 'sender', width: 24 },
    { header: 'ธนาคาร', key: 'bank', width: 18 },
    { header: 'ยอดก่อน VAT', key: 'subtotal', width: 16 },
    { header: 'VAT', key: 'vat', width: 14 },
    { header: 'จำนวนเงินสุทธิ (฿)', key: 'total', width: 18 },
    { header: 'Reference ID', key: 'ref', width: 22 },
    { header: 'หมายเหตุ', key: 'notes', width: 28 },
  ];
  styleHeaderRow(sheetExpense, 11);

  for (const tx of confirmedExpense) {
    const row = sheetExpense.addRow({
      date: toExcelDate(tx.transaction_date),
      time: tx.transaction_time || '-',
      category: tx.category_name,
      receiver: tx.merchant_name || tx.receiver_name || '-',
      sender: tx.sender_name || '-',
      bank: tx.sender_bank || tx.receiver_bank || '-',
      subtotal: tx.subtotal ?? null,
      vat: tx.vat_amount ?? null,
      total: Number(tx.total_amount ?? tx.amount ?? 0),
      ref: tx.reference_id || '-',
      notes: tx.notes || tx.description || '',
    });
    row.getCell(1).numFmt = DATE_NUMFMT;
    if (tx.subtotal !== null) row.getCell(7).numFmt = CURRENCY_NUMFMT;
    if (tx.vat_amount !== null) row.getCell(8).numFmt = CURRENCY_NUMFMT;
    row.getCell(9).numFmt = CURRENCY_NUMFMT;
  }

  const expenseLastDataRow = Math.max(2, confirmedExpense.length + 1);
  const expenseSumRow = sheetExpense.addRow({
    date: 'รวมรายจ่ายทั้งหมด',
    total: {
      formula: confirmedExpense.length > 0 ? `SUM(I2:I${expenseLastDataRow})` : '0',
      result: summary.total_expense,
    },
  });
  expenseSumRow.font = { bold: true };
  expenseSumRow.getCell(9).numFmt = CURRENCY_NUMFMT;
  sheetExpense.autoFilter = `A1:K${expenseLastDataRow}`;

  // ===========================================================================
  // SHEET 4: Transactions (All Transactions)
  // ===========================================================================
  const sheetAll = workbook.addWorksheet('Transactions');
  sheetAll.columns = [
    { header: 'วันที่', key: 'date', width: 15 },
    { header: 'เวลา', key: 'time', width: 12 },
    { header: 'ประเภท', key: 'direction', width: 18 },
    { header: 'สถานะ', key: 'status', width: 16 },
    { header: 'หมวดหมู่', key: 'category', width: 22 },
    { header: 'ชื่อผู้โอน', key: 'sender', width: 24 },
    { header: 'ชื่อผู้รับ / ร้านค้า', key: 'receiver', width: 26 },
    { header: 'ธนาคาร', key: 'bank', width: 18 },
    { header: 'ยอดก่อน VAT', key: 'subtotal', width: 16 },
    { header: 'VAT', key: 'vat', width: 14 },
    { header: 'จำนวนเงินสุทธิ (฿)', key: 'total', width: 18 },
    { header: 'Reference ID', key: 'ref', width: 22 },
    { header: 'รายละเอียด / หมายเหตุ', key: 'notes', width: 32 },
  ];
  styleHeaderRow(sheetAll, 13);

  for (const tx of scopedTxs) {
    const row = sheetAll.addRow({
      date: toExcelDate(tx.transaction_date),
      time: tx.transaction_time || '-',
      direction: tx.direction,
      status: tx.status,
      category: tx.category_name,
      sender: tx.sender_name || '-',
      receiver: tx.receiver_name || tx.merchant_name || '-',
      bank: tx.sender_bank || tx.receiver_bank || '-',
      subtotal: tx.subtotal ?? null,
      vat: tx.vat_amount ?? null,
      total: Number(tx.total_amount ?? tx.amount ?? 0),
      ref: tx.reference_id || '-',
      notes: tx.notes || tx.review_reason || tx.description || '',
    });
    row.getCell(1).numFmt = DATE_NUMFMT;
    if (tx.subtotal !== null) row.getCell(9).numFmt = CURRENCY_NUMFMT;
    if (tx.vat_amount !== null) row.getCell(10).numFmt = CURRENCY_NUMFMT;
    row.getCell(11).numFmt = CURRENCY_NUMFMT;
  }

  const allLastRow = Math.max(2, scopedTxs.length + 1);
  sheetAll.autoFilter = `A1:M${allLastRow}`;

  // ===========================================================================
  // SHEET 5: Categories (Category Breakdown)
  // ===========================================================================
  const sheetCats = workbook.addWorksheet('Categories');
  sheetCats.columns = [
    { header: 'ประเภท', key: 'direction', width: 16 },
    { header: 'หมวดหมู่', key: 'category', width: 28 },
    { header: 'จำนวนรายการ (Confirmed)', key: 'count', width: 24 },
    { header: 'ยอดรวม (฿)', key: 'amount', width: 20 },
  ];
  styleHeaderRow(sheetCats, 4);

  const catSummaryMap = new Map<
    string,
    { direction: string; category: string; count: number; amount: number }
  >();

  for (const tx of scopedTxs) {
    if (tx.status !== 'confirmed') continue;
    if (tx.direction !== 'income' && tx.direction !== 'expense') continue;
    const key = `${tx.direction}::${tx.category_name}`;
    const existing = catSummaryMap.get(key) || {
      direction: tx.direction === 'income' ? 'รายรับ (Income)' : 'รายจ่าย (Expense)',
      category: tx.category_name,
      count: 0,
      amount: 0,
    };
    existing.count += 1;
    existing.amount += Number(tx.total_amount ?? tx.amount ?? 0);
    catSummaryMap.set(key, existing);
  }

  const catRows = Array.from(catSummaryMap.values()).sort((a, b) => b.amount - a.amount);
  for (const item of catRows) {
    const row = sheetCats.addRow({
      direction: item.direction,
      category: item.category,
      count: item.count,
      amount: Number(item.amount.toFixed(2)),
    });
    row.getCell(4).numFmt = CURRENCY_NUMFMT;
  }

  const catLastRow = Math.max(2, catRows.length + 1);
  const catTotalRow = sheetCats.addRow({
    direction: 'รวมทั้งหมด',
    category: '',
    count: {
      formula: catRows.length > 0 ? `SUM(C2:C${catLastRow})` : '0',
      result: catRows.reduce((acc, r) => acc + r.count, 0),
    },
    amount: {
      formula: catRows.length > 0 ? `SUM(D2:D${catLastRow})` : '0',
      result: Number(catRows.reduce((acc, r) => acc + r.amount, 0).toFixed(2)),
    },
  });
  catTotalRow.font = { bold: true };
  catTotalRow.getCell(4).numFmt = CURRENCY_NUMFMT;
  sheetCats.autoFilter = `A1:D${catLastRow}`;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates a UTF-8 BOM CSV string so Microsoft Excel on Windows/Mac displays Thai characters cleanly.
 */
export function generateMoneyMateCSV(
  allTransactions: TransactionRecord[],
  range?: DateRangeFilter
): string {
  const scoped = filterTransactionsByDateRange(allTransactions, range);

  const headers = [
    'วันที่',
    'เวลา',
    'ประเภท',
    'สถานะ',
    'หมวดหมู่',
    'ชื่อผู้โอน',
    'ชื่อผู้รับ/ร้านค้า',
    'ธนาคารผู้โอน',
    'ธนาคารผู้รับ',
    'ยอดก่อน VAT',
    'VAT',
    'จำนวนเงินสุทธิ (THB)',
    'Reference ID',
    'หมายเหตุ',
  ];

  const escapeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    // Prevent CSV Formula Injection (=, +, -, @)
    const sanitized = /^[=+\-@]/.test(str) ? `'${str}` : str;
    return `"${sanitized}"`;
  };

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const tx of scoped) {
    lines.push(
      [
        tx.transaction_date || '',
        tx.transaction_time || '',
        tx.direction,
        tx.status,
        tx.category_name,
        tx.sender_name || '',
        tx.receiver_name || tx.merchant_name || '',
        tx.sender_bank || '',
        tx.receiver_bank || '',
        tx.subtotal ?? '',
        tx.vat_amount ?? '',
        Number(tx.total_amount ?? tx.amount ?? 0).toFixed(2),
        tx.reference_id || '',
        tx.notes || tx.description || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return '\uFEFF' + lines.join('\r\n');
}
