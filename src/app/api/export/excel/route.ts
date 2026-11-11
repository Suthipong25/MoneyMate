import { NextResponse, type NextRequest } from 'next/server';
import { requireCustomerSession } from '@/lib/security/auth-session';
import { MoneyMateRepo } from '@/lib/supabase/repository';
import { generateMoneyMateExcelBuffer } from '@/lib/export/excel-builder';

export async function GET(request: NextRequest) {
  try {
    const user = await requireCustomerSession(true);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const transactions = MoneyMateRepo.getTransactionsForUser(user.id);
    const categories = MoneyMateRepo.getCategoriesForUser(user.id);

    const buffer = await generateMoneyMateExcelBuffer(
      transactions,
      { startDate, endDate },
      categories
    );

    const fileName = `MoneyMate_Report_${startDate || 'ALL'}_to_${
      endDate || 'NOW'
    }.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'ไม่สามารถสร้างไฟล์ Excel ได้',
      },
      { status: 500 }
    );
  }
}
