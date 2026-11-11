import { NextResponse, type NextRequest } from 'next/server';
import { requireCustomerSession } from '@/lib/security/auth-session';
import { MoneyMateRepo } from '@/lib/supabase/repository';
import { generateMoneyMateCSV } from '@/lib/export/excel-builder';

export async function GET(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const transactions = MoneyMateRepo.getTransactionsForUser(user.id);
    const csvContent = generateMoneyMateCSV(transactions, {
      startDate,
      endDate,
    });

    const fileName = `MoneyMate_Transactions_${startDate || 'ALL'}_to_${
      endDate || 'NOW'
    }.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ไม่สามารถสร้างไฟล์ CSV ได้' },
      { status: 500 }
    );
  }
}
