/*
THESIS: MoneyMate turns messy Thai bank slips and receipts into a cute, stamp-verified Kakeibo ledger sheet on the spot, refusing the generic SaaS card-grid template.
OWN-WORLD: Crisp white ledger sheets (#FFFFFF) on a sky-blue desk mat (#EEF6FF), ruled in deep navy (#1E3A8A) and sky blue (#0284C7) with double crimson-red accounting lines (#DC2626) and rounded Mitr/Mali/Anuphan lettering.
STORY: Online merchants see 5 real slips become a balanced income/expense/VAT table in 3 seconds, test their own slip volume and VAT, and top up credits via PromptPay.
FIRST VIEWPORT: Asymmetric 12-column desk: left 5 columns hold the Mitr headline, crimson primary upload CTA, and 3-column trust ledger; right 7 columns hold the live interactive 5-slip Kakeibo sheet with crimson double-rule header.
FORM: Candidate 6 (Cute Kakeibo Stationery Ledger & Stamp-Verified Slip Desk), position 6 of 7, seed key a6303d3a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
*/
import type { Metadata } from 'next';
import './globals.css';

const appUrl = process.env.APP_URL || 'https://moneymate.co.th';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default:
      'MoneyMate (เพื่อนช่วยจัดการเงิน) — แปลงรูปสลิปและใบเสร็จเป็น Excel สรุปรายรับ-รายจ่ายด้วย AI',
    template: '%s | MoneyMate เพื่อนช่วยจัดการเงิน',
  },
  description:
    'โยนรูปสลิปธนาคาร ใบเสร็จรับเงิน และใบกำกับภาษีสูงสุด 100 รูป ให้ AI อ่านยอด แยกรายรับ-รายจ่าย ถอด VAT 7% ตรวจจับสลิปซ้ำ 2 ชั้น และ Export Excel (.xlsx 5 ชีต) ในคลิกเดียว',
  keywords: [
    'แปลงรูปสลิปเป็น Excel',
    'โปรแกรมสรุปรายรับรายจ่าย แม่ค้าออนไลน์',
    'เช็คสลิปซ้ำ สรุปยอดโอน',
    'แยก VAT 7% จากใบเสร็จ อัตโนมัติ',
    'ทำบัญชีสลิปธนาคาร AI',
    'MoneyMate เพื่อนช่วยจัดการเงิน',
  ],
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: appUrl,
    siteName: 'MoneyMate — เพื่อนช่วยจัดการเงิน',
    title:
      'MoneyMate — โยนสลิป 100 รูป ออกเป็นงบรายรับ-รายจ่าย & Excel ในคลิกเดียว',
    description:
      'เพื่อนช่วยจัดการเงินสำหรับร้านค้าออนไลน์และฟรีแลนซ์ สแกนสลิป/ใบเสร็จด้วย AI แม่นยำ ตรวจสลิปซ้ำอัตโนมัติ ทดลองใช้ฟรี 5 รูปแรก',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MoneyMate (เพื่อนช่วยจัดการเงิน)',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: [
      {
        '@type': 'Offer',
        name: 'FREE Trial (5 Credits)',
        price: '0',
        priceCurrency: 'THB',
      },
      {
        '@type': 'Offer',
        name: 'STARTER (100 Credits)',
        price: '59',
        priceCurrency: 'THB',
      },
      {
        '@type': 'Offer',
        name: 'BUSINESS (500 Credits)',
        price: '199',
        priceCurrency: 'THB',
      },
    ],
    description:
      'ระบบ AI อ่านรูปสลิปโอนเงิน ใบเสร็จ และใบกำกับภาษี วิเคราะห์รายรับ-รายจ่าย ตรวจสลิปซ้ำ และส่งออกไฟล์ Excel 5 ชีตอัตโนมัติ',
  };

  const contractHtmlComment = `<!-- THESIS: MoneyMate Kakeibo Stationery Ledger | OWN-WORLD: #EEF6FF Sky Mat, #FFFFFF Sheet, #1E3A8A Navy, #0284C7 Sky, #DC2626 Crimson Red, Mitr/Mali/Anuphan | FORM: Candidate 6, seed key a6303d3a | FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->`;

  return (
    <html lang="th" data-type="software">
      <head>
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Mali:wght@500;600;700&family=Mitr:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-ink antialiased">
        <div
          hidden
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: contractHtmlComment }}
        />
        {children}
      </body>
    </html>
  );
}
