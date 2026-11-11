'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
  AlertTriangle,
  ChevronDown,
  Eye,
  EyeOff,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import { formatTHB } from '@/lib/utils/formatters';

interface DemoSlipItem {
  id: string;
  fileName: string;
  docType: string;
  date: string;
  time: string;
  party: string;
  bank: string;
  direction: 'income' | 'expense' | 'duplicate';
  category: string;
  subtotal: number;
  vat: number;
  total: number;
  refId: string;
  note: string;
}

const DEMO_SLIP_SAMPLES: DemoSlipItem[] = [
  {
    id: 'demo-1',
    fileName: 'slip_kbank_order_101.jpg',
    docType: 'สลิปโอนเงิน',
    date: '09 พ.ย. 2569',
    time: '10:14',
    party: 'คุณวิภาดา ศรีสุข → ร้านมณีเมท',
    bank: 'KBANK → SCB (บัญชีร้าน)',
    direction: 'income',
    category: 'รายได้จากการขาย',
    subtotal: 4500.0,
    vat: 0,
    total: 4500.0,
    refId: '20261109KBANK9001',
    note: 'เงินเข้าเลขบัญชีร้านที่ลงทะเบียนไว้ บันทึกเป็นรายรับ',
  },
  {
    id: 'demo-2',
    fileName: 'tax_invoice_flash_express.png',
    docType: 'ใบกำกับภาษี',
    date: '09 พ.ย. 2569',
    time: '11:42',
    party: 'ร้านมณีเมท → Flash Express',
    bank: 'SCB (บัญชีร้าน)',
    direction: 'expense',
    category: 'ค่าขนส่งพัสดุ',
    subtotal: 1100.0,
    vat: 77.0,
    total: 1177.0,
    refId: 'THFX20261109-882',
    note: 'แยกยอดก่อนภาษี 1,100.00 และภาษีซื้อ VAT 7% (77.00)',
  },
  {
    id: 'demo-3',
    fileName: 'tax_invoice_makro_supplies.jpg',
    docType: 'ใบกำกับภาษี',
    date: '09 พ.ย. 2569',
    time: '13:05',
    party: 'ร้านมณีเมท → บมจ. สยามแม็คโคร',
    bank: 'SCB (บัญชีร้าน)',
    direction: 'expense',
    category: 'ค่าวัตถุดิบและวัสดุสิ้นเปลือง',
    subtotal: 2500.0,
    vat: 175.0,
    total: 2675.0,
    refId: 'MK20261109-4410',
    note: 'แยกยอดก่อนภาษี 2,500.00 และภาษีซื้อ VAT 7% (175.00)',
  },
  {
    id: 'demo-4',
    fileName: 'slip_bbl_consulting_fee.jpg',
    docType: 'สลิปโอนเงิน',
    date: '09 พ.ย. 2569',
    time: '15:28',
    party: 'บจก. ธนกร พงษ์ไพศาล → ร้านมณีเมท',
    bank: 'BBL → SCB (บัญชีร้าน)',
    direction: 'income',
    category: 'รายได้จากการขาย',
    subtotal: 3657.0,
    vat: 0,
    total: 3657.0,
    refId: '20261109BBL3358',
    note: 'เงินเข้าเลขบัญชีร้านที่ลงทะเบียนไว้ บันทึกเป็นรายรับ',
  },
  {
    id: 'demo-5',
    fileName: 'slip_kbank_duplicate_ref.jpg',
    docType: 'สลิปซ้ำรหัสเดิม',
    date: '09 พ.ย. 2569',
    time: '16:02',
    party: 'คุณวิภาดา ศรีสุข → ร้านมณีเมท',
    bank: 'KBANK → SCB (บัญชีร้าน)',
    direction: 'duplicate',
    category: 'คัดออก (รหัสอ้างอิงซ้ำ)',
    subtotal: 4500.0,
    vat: 0,
    total: 4500.0,
    refId: '20261109KBANK9001',
    note: 'ตรงกับรหัสอ้างอิงใบที่ 1 ระบบตัดออกอัตโนมัติและไม่หักเครดิต',
  },
];

const ACCOUNTING_RULES = [
  {
    situation: 'เงินโอนเข้าเลขบัญชีร้านค้าของคุณ',
    mechanism: 'เทียบเลขบัญชีผู้รับในสลิปกับรายการบัญชีธนาคารธุรกิจที่คุณผูกไว้ในระบบ',
    outcome: 'บันทึกเข้าสมุดรายวันรับ (Income) อัตโนมัติ พร้อมเก็บเลข Reference ID ธนาคาร',
    creditRule: 'หัก 1 เครดิต',
  },
  {
    situation: 'ใบกำกับภาษีเต็มรูป / บิลค่าขนส่ง / บิลซื้อของ',
    mechanism: 'อ่านยอดรวมสุทธิ ยอดก่อนภาษีมูลค่าเพิ่ม และแยกภาษีซื้อ VAT 7% ออกจากตัวบิล',
    outcome: 'บันทึกเข้าสมุดรายวันจ่าย (Expense) และรวมยอดภาษีซื้อสำหรับเตรียมยื่น ภ.พ.30',
    creditRule: 'หัก 1 เครดิต',
  },
  {
    situation: 'โอนเงินข้ามไปมาระหว่าง 2 บัญชีของร้านตัวเอง',
    mechanism: 'ตรวจพบว่าทั้งบัญชีต้นทางและบัญชีปลายทางเป็นชื่อหรือเลขบัญชีของธุรกิจคุณเอง',
    outcome: 'แยกเป็นรายการโอนภายใน (Internal Transfer) ไม่นำไปบวกเป็นรายได้หรือค่าใช้จ่ายซ้ำซ้อน',
    creditRule: 'หัก 1 เครดิต',
  },
  {
    situation: 'อัปโหลดไฟล์ซ้ำ สลิปซ้ำรหัสเดิม หรือภาพเบลออ่านไม่ได้',
    mechanism: 'ตรวจค่าลายนิ้วมือไฟล์ (SHA-256) ก่อนส่งอ่าน และตรวจเลข Reference ID ซ้ำในฐานข้อมูล',
    outcome: 'ระงับการบันทึกลงสมุดบัญชีเพื่อป้องกันยอดเงินซ้ำ และคืนโควตาให้ทันที',
    creditRule: '0 เครดิต (ไม่คิดเงิน)',
  },
];

const FAQS = [
  {
    q: 'อัปโหลดรูปสลิปซ้ำหรือรูปที่อ่านไม่สำเร็จ จะถูกหักเครดิตหรือไม่?',
    a: 'ไม่หักเครดิตครับ ระบบตรวจสอบความซ้ำซ้อน 2 ชั้น (รหัสไฟล์ SHA-256 และรหัสอ้างอิงธนาคาร Reference ID) จะหัก 1 เครดิตเฉพาะรายการที่อ่านข้อมูลสำเร็จและไม่ซ้ำกับที่มีอยู่ในระบบเท่านั้น',
  },
  {
    q: 'ระบบรู้ได้อย่างไรว่าสลิปใบไหนเป็นรายรับหรือรายจ่ายของร้าน?',
    a: 'คุณสามารถระบุชื่อร้านและเลขบัญชีธนาคารที่ใช้รับ-จ่ายเงินไว้ที่หน้าตั้งค่าบัญชีธุรกิจ เมื่ออัปโหลดสลิปเข้ามา ระบบจะดูว่าเงินไหลเข้าหรือไหลออกจากบัญชีร้านของคุณ และหากโอนระหว่างบัญชีตัวเองจะถูกแยกออกไม่ให้นับรวมในงบกำไรขาดทุน',
  },
  {
    q: 'ตั๋วเครดิตที่เติมไว้มีวันหมดอายุหรือไม่?',
    a: 'ไม่มีวันหมดอายุครับ เติมเครดิตครั้งเดียวสามารถเก็บไว้ใช้ข้ามเดือนหรือข้ามปีได้จนกว่าเครดิตจะหมด เหมาะกับร้านค้าและฟรีแลนซ์ที่ไม่ต้องการจ่ายค่ารายเดือนคงที่ทุกเดือน',
  },
  {
    q: 'ไฟล์ Excel ที่ส่งออกมีหน้าตาและโครงสร้างอย่างไร?',
    a: 'เมื่อกด Export Excel ระบบจะสร้างไฟล์ .xlsx มาตรฐานที่แบ่งออกเป็น 5 ชีตในไฟล์เดียว ได้แก่ 1. Summary (สรุปรายรับ-รายจ่ายและภาษี), 2. Transactions (สมุดรายวันรวม), 3. Income (รายรับ), 4. Expense (รายจ่ายและภาษีซื้อ), และ 5. By_Category (สรุปตามหมวดหมู่) สามารถส่งต่อให้สำนักงานบัญชีได้ทันที',
  },
  {
    q: 'ข้อมูลภาพสลิปของลูกค้าปลอดภัยตามมาตรฐาน PDPA หรือไม่?',
    a: 'ไฟล์ภาพทั้งหมดถูกจัดเก็บในพื้นที่ส่วนตัว (Private Storage) ที่จำกัดสิทธิ์เฉพาะเจ้าของบัญชีเท่านั้น และคุณสามารถกดสั่งล้างไฟล์ภาพต้นฉบับออกจากเซิร์ฟเวอร์ได้ตลอดเวลาหลังส่งออกไฟล์ Excel เสร็จสิ้น',
  },
];

type WorkbenchTab = 'ledger' | 'summary' | 'income' | 'expense' | 'category';

export default function LandingPage() {
  const [trialCredits, setTrialCredits] = useState<number>(5);
  const [demoRunning, setDemoRunning] = useState(false);
  const [revealedCount, setRevealedCount] = useState<number>(5);
  const [trialStatusMsg, setTrialStatusMsg] = useState<string | null>(null);
  const [selectedDemoSlip, setSelectedDemoSlip] = useState<DemoSlipItem>(DEMO_SLIP_SAMPLES[0]!);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('ledger');
  const [maskPdpa, setMaskPdpa] = useState<boolean>(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  // Slip Volume & Cost Estimator
  const [monthlySlips, setMonthlySlips] = useState<number>(300);

  // Quick VAT 7% Worksheet
  const [vatInputAmount, setVatInputAmount] = useState<string>('1070');
  const [vatMode, setVatMode] = useState<'extract' | 'add'>('extract');

  useEffect(() => {
    fetch('/api/trial')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.creditsRemaining === 'number') {
          setTrialCredits(d.creditsRemaining);
        }
      })
      .catch(() => {});
  }, []);

  const runInteractiveDemo = async () => {
    setDemoRunning(true);
    setWorkbenchTab('ledger');
    setRevealedCount(0);
    setTrialStatusMsg('กำลังอ่านข้อมูลจากภาพสลิปและตรวจสอบรหัสอ้างอิงธนาคาร...');

    for (let i = 1; i <= DEMO_SLIP_SAMPLES.length; i++) {
      await new Promise((r) => setTimeout(r, 200));
      setRevealedCount(i);
      setSelectedDemoSlip(DEMO_SLIP_SAMPLES[i - 1]!);
    }

    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDuplicate: false }),
    }).then((r) => r.json());

    if (typeof res.creditsRemaining === 'number') {
      setTrialCredits(res.creditsRemaining);
    }
    setDemoRunning(false);
    setTrialStatusMsg(
      'อ่านข้อมูลครบ 5 ใบ: บันทึกรายรับ 2 ใบ, รายจ่ายพร้อมถอด VAT 2 ใบ, และคัดสลิปซ้ำออก 1 ใบ (ไม่คิดเครดิต)'
    );
  };

  const formatPartyName = (raw: string) =>
    maskPdpa ? raw.replace(/คุณ[^\s]+/, 'คุณวิ***') : raw;

  // Calculations for the 5 demo slips
  const visibleSlips = DEMO_SLIP_SAMPLES.slice(0, revealedCount);
  const confirmedIncomeTotal = visibleSlips
    .filter((s) => s.direction === 'income')
    .reduce((acc, s) => acc + s.total, 0);
  const confirmedExpenseTotal = visibleSlips
    .filter((s) => s.direction === 'expense')
    .reduce((acc, s) => acc + s.total, 0);
  const confirmedVatTotal = visibleSlips
    .filter((s) => s.direction === 'expense')
    .reduce((acc, s) => acc + s.vat, 0);
  const netBalance = confirmedIncomeTotal - confirmedExpenseTotal;

  // Workload & Cost Calculations
  const manualHoursSaved = Number(((monthlySlips * 1.5) / 60).toFixed(1));
  const estimatedCreditCost = Math.round(monthlySlips * 0.39);

  // VAT Worksheet Calculation
  const numVatInput = Math.max(0, Number(vatInputAmount) || 0);
  const vatBase =
    vatMode === 'extract'
      ? Number(((numVatInput * 100) / 107).toFixed(2))
      : Number(numVatInput.toFixed(2));
  const vatSeven =
    vatMode === 'extract'
      ? Number((numVatInput - vatBase).toFixed(2))
      : Number((numVatInput * 0.07).toFixed(2));
  const vatGrandTotal =
    vatMode === 'extract'
      ? Number(numVatInput.toFixed(2))
      : Number((vatBase + vatSeven).toFixed(2));

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      {/* TOP ARCHITECTURAL HEADER */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={mobileNavOpen ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก'}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 rounded-inner border border-border text-ink hover:bg-surface-muted mm-interactive"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/brand/logo-header.png?v=3"
                alt="MoneyMate เพื่อนช่วยจัดการเงิน"
                width={156}
                height={40}
                priority
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </Link>
          </div>

          <nav
            aria-label="เมนูหลัก"
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-ink-secondary"
          >
            <a href="#workbench" className="hover:text-brand mm-interactive">
              สมุดรายวันตัวอย่าง
            </a>
            <a href="#accounting-rules" className="hover:text-brand mm-interactive">
              เกณฑ์การแยกบัญชี
            </a>
            <a href="#vat-worksheet" className="hover:text-brand mm-interactive">
              คำนวณภาษีและต้นทุน
            </a>
            <Link href="/tools/vat-calculator" className="hover:text-brand mm-interactive">
              เครื่องมือถอด VAT 7%
            </Link>
            <a href="#pricing" className="hover:text-brand mm-interactive">
              อัตราค่าเครดิต
            </a>
            <a href="#faq" className="hover:text-brand mm-interactive">
              คำถามที่พบบ่อย
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-3.5 py-2 text-sm font-medium text-ink-secondary hover:text-ink rounded-inner mm-interactive"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
            >
              เริ่มใช้งานฟรี {trialCredits} รูป
            </Link>
          </div>
        </div>

        {mobileNavOpen && (
          <nav
            aria-label="เมนูสำหรับหน้าจอมือถือ"
            className="lg:hidden bg-surface border-t border-border px-4 py-3 space-y-1 text-sm"
          >
            <a
              href="#workbench"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-ink-secondary hover:text-brand"
            >
              สมุดรายวันตัวอย่าง
            </a>
            <a
              href="#accounting-rules"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-ink-secondary hover:text-brand"
            >
              เกณฑ์การแยกบัญชี
            </a>
            <a
              href="#vat-worksheet"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-ink-secondary hover:text-brand"
            >
              คำนวณภาษีและต้นทุน
            </a>
            <Link
              href="/tools/vat-calculator"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-ink-secondary hover:text-brand"
            >
              เครื่องมือถอด VAT 7%
            </Link>
            <a
              href="#pricing"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-ink-secondary hover:text-brand"
            >
              อัตราค่าเครดิต
            </a>
            <Link
              href="/login"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 font-semibold text-brand"
            >
              เข้าสู่ระบบพอร์ทัล
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* SECTION 1: EDITORIAL HERO + TRUE-SCALE ACCOUNTING WORKBENCH */}
        <section className="pt-10 pb-16 sm:pt-14 sm:pb-20 border-b border-border bg-gradient-to-b from-surface to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            {/* Editorial Header Band */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mm-hero-enter">
              <div className="lg:col-span-8 space-y-4">
                <p className="text-xs font-medium text-brand">
                  ระบบจัดการสลิปโอนเงิน ใบเสร็จรับเงิน และใบกำกับภาษีสำหรับร้านค้าออนไลน์
                </p>
                <h1 className="text-3xl sm:text-5xl font-display font-semibold text-ink leading-[1.16]">
                  โยนรูปสลิปและใบกำกับภาษี 100 ใบ ออกเป็นสมุดรายวันและงบ Excel 5 ชีต
                </h1>
                <p className="text-base sm:text-lg text-ink-secondary max-w-[64ch] leading-relaxed">
                  อ่านยอดเงินจากสลิปธนาคารไทยทุกแห่ง แยกรายรับ-รายจ่ายตามเลขบัญชีร้านค้าของคุณ 
                  ถอดภาษีมูลค่าเพิ่ม 7% และคัดสลิปซ้ำออกก่อนบันทึกบัญชี จ่ายตามจำนวนรูปที่ใช้งานจริง безค่ารายเดือน
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4">
                <div className="flex items-center gap-3.5 bg-surface px-4 py-2.5 rounded-outer border border-border">
                  <Image
                    src="/brand/sticker-hero-big.png"
                    alt="มาสคอต MoneyMate"
                    width={64}
                    height={64}
                    priority
                    className="w-14 h-14 object-contain shrink-0"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-ink">ทดลองอัปโหลดสลิปจริงได้ทันที</p>
                    <p className="text-ink-muted tabular-nums">
                      โควตาทดลองใช้ฟรีคงเหลือ {trialCredits} รูป (สลิปซ้ำไม่หักเครดิต)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto lg:w-full lg:justify-end">
                  <Link
                    href="/app/upload"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-expense hover:opacity-95 rounded-inner mm-interactive"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>อัปโหลดสลิปชุดแรก</span>
                  </Link>
                  <Link
                    href="/app/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-ink bg-surface border border-border-strong hover:bg-surface-muted rounded-inner mm-interactive"
                  >
                    <span>เปิดแดชบอร์ดร้านค้า</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* TRUE-SCALE ACCOUNTING WORKBENCH (app-frame) */}
            <div
              id="workbench"
              className="bg-surface border border-border-strong rounded-outer overflow-hidden shadow-sm"
            >
              {/* Workbench Top Toolbar */}
              <div className="bg-surface-muted px-4 sm:px-6 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">
                    สมุดงานบัญชี: ร้านมณีเมท สตูดิโอ (บัญชีรับ-จ่ายหลัก: SCB 409-2-xxxxx-1)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMaskPdpa(!maskPdpa)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border text-ink-secondary hover:text-ink mm-interactive"
                  >
                    {maskPdpa ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-brand" />
                        <span>แสดงชื่อคู่ค้าเต็ม</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-brand" />
                        <span>คาดปิดชื่อส่วนบุคคล (PDPA)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={runInteractiveDemo}
                    disabled={demoRunning}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-brand text-white font-semibold hover:bg-brand-hover mm-interactive"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${demoRunning ? 'animate-spin' : ''}`} />
                    <span>{demoRunning ? 'กำลังอ่านสลิป 5 ใบ...' : 'รันการอ่านสลิปตัวอย่าง 5 ใบใหม่'}</span>
                  </button>
                </div>
              </div>

              {trialStatusMsg && (
                <div
                  role="status"
                  aria-live="polite"
                  className="px-4 sm:px-6 py-2 bg-brand-soft border-b border-border text-xs text-brand font-medium"
                >
                  {trialStatusMsg}
                </div>
              )}

              {/* Split Accounting Desk: Left 4 cols = Slip Queue & Inspector, Right 8 cols = Live Spreadsheet */}
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
                
                {/* Left Column: 5 Incoming Slips & Selected Document Detail */}
                <div className="lg:col-span-4 p-4 sm:p-5 space-y-4 bg-background/60">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-ink">
                      ไฟล์ภาพในคิวตรวจสอบ (5 ไฟล์)
                    </h2>
                    <span className="text-[11px] text-ink-muted">คลิกที่รายการเพื่อดูค่าที่อ่านได้</span>
                  </div>

                  <div className="divide-y divide-border border border-border rounded-inner bg-surface overflow-hidden">
                    {DEMO_SLIP_SAMPLES.map((slip, index) => {
                      const isSelected = selectedDemoSlip.id === slip.id;
                      return (
                        <button
                          key={slip.id}
                          type="button"
                          onClick={() => setSelectedDemoSlip(slip)}
                          className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between gap-2 mm-interactive ${
                            isSelected
                              ? 'bg-brand-soft/80 text-brand font-semibold'
                              : 'hover:bg-surface-muted text-ink'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate">
                              {index + 1}. {slip.fileName}
                            </p>
                            <p className="text-[11px] text-ink-muted truncate">
                              {slip.docType} — {formatPartyName(slip.party)}
                            </p>
                          </div>
                          <span
                            className={`tabular-nums font-mono font-semibold shrink-0 ${
                              slip.direction === 'income'
                                ? 'text-sky'
                                : slip.direction === 'expense'
                                  ? 'text-expense'
                                  : 'text-ink-muted line-through'
                            }`}
                          >
                            {slip.direction === 'income' ? '+' : slip.direction === 'expense' ? '-' : ''}
                            {slip.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Slip Extraction Card */}
                  <div className="p-4 rounded-inner bg-surface border border-border space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2.5 border-b border-border">
                      <div>
                        <p className="font-semibold text-ink">{selectedDemoSlip.docType}</p>
                        <p className="text-[11px] text-ink-muted font-mono tabular-nums">
                          Ref: {selectedDemoSlip.refId}
                        </p>
                      </div>
                      <Image
                        src={
                          selectedDemoSlip.direction === 'duplicate'
                            ? '/brand/sticker-alert.png'
                            : '/brand/sticker-laptop.png'
                        }
                        alt="สถานะการตรวจสอบเอกสาร"
                        width={44}
                        height={44}
                        className="w-11 h-11 object-contain shrink-0"
                      />
                    </div>

                    <dl className="space-y-1.5">
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">วันที่และเวลาในเอกสาร</dt>
                        <dd className="font-medium text-ink tabular-nums">
                          {selectedDemoSlip.date} ({selectedDemoSlip.time} น.)
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">ธนาคาร / ช่องทาง</dt>
                        <dd className="font-medium text-ink">{selectedDemoSlip.bank}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">มูลค่าก่อนภาษี</dt>
                        <dd className="font-mono tabular-nums text-ink">
                          ฿{selectedDemoSlip.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">ภาษีมูลค่าเพิ่ม (VAT 7%)</dt>
                        <dd className="font-mono tabular-nums text-ink">
                          ฿{selectedDemoSlip.vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    </dl>

                    <div
                      className={`p-2.5 rounded text-[11px] border ${
                        selectedDemoSlip.direction === 'duplicate'
                          ? 'bg-expense-soft border-expense/30 text-expense font-medium'
                          : 'bg-surface-muted border-border text-ink-secondary'
                      }`}
                    >
                      {selectedDemoSlip.note}
                    </div>
                  </div>
                </div>

                {/* Right Column: Live 5-Sheet Accounting Table */}
                <div className="lg:col-span-8 flex flex-col justify-between bg-surface">
                  <div>
                    {/* Spreadsheet Worksheet Tabs */}
                    <div
                      role="tablist"
                      aria-label="เลือกดูชีตในสมุดงาน Excel"
                      className="flex flex-wrap items-center gap-1 px-4 pt-3 bg-surface-muted border-b border-border text-xs"
                    >
                      {(
                        [
                          { id: 'ledger', label: 'สมุดรายวันรวม (Transactions)' },
                          { id: 'summary', label: 'ชีต 1: สรุปงบ (Summary)' },
                          { id: 'income', label: 'ชีต 3: รายรับ (Income)' },
                          { id: 'expense', label: 'ชีต 4: รายจ่าย & ภาษีซื้อ (VAT 7%)' },
                          { id: 'category', label: 'ชีต 5: แยกตามหมวดหมู่' },
                        ] as Array<{ id: WorkbenchTab; label: string }>
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={workbenchTab === tab.id}
                          onClick={() => setWorkbenchTab(tab.id)}
                          className={`px-3.5 py-2 rounded-t-inner font-medium border-t border-x mm-interactive -mb-px ${
                            workbenchTab === tab.id
                              ? 'bg-surface text-brand font-semibold border-border'
                              : 'bg-transparent text-ink-secondary border-transparent hover:text-ink'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Spreadsheet Table Body */}
                    <div className="overflow-x-auto">
                      {workbenchTab === 'ledger' && (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-muted/50 text-ink-secondary">
                              <th className="py-2.5 px-4 font-semibold">วันที่ / เวลา</th>
                              <th className="py-2.5 px-3 font-semibold">คู่ค้า / รายการ</th>
                              <th className="py-2.5 px-3 font-semibold">หมวดหมู่</th>
                              <th className="py-2.5 px-3 font-semibold">รหัสอ้างอิง (Ref ID)</th>
                              <th className="py-2.5 px-3 font-semibold text-right">VAT 7%</th>
                              <th className="py-2.5 px-4 font-semibold text-right">ยอดสุทธิ (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {visibleSlips.map((row) => {
                              const isDup = row.direction === 'duplicate';
                              const isHighlighted = selectedDemoSlip.id === row.id;
                              return (
                                <tr
                                  key={row.id}
                                  onClick={() => setSelectedDemoSlip(row)}
                                  className={`cursor-pointer ${
                                    isHighlighted
                                      ? 'bg-brand-soft/40'
                                      : isDup
                                        ? 'bg-expense-soft/30 text-ink-muted'
                                        : 'hover:bg-surface-muted/50'
                                  }`}
                                >
                                  <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                                    <span className="font-medium text-ink">{row.date}</span>
                                    <span className="block text-[11px] text-ink-muted">{row.time} น.</span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <p className={`font-medium ${isDup ? 'line-through text-ink-muted' : 'text-ink'}`}>
                                      {formatPartyName(row.party)}
                                    </p>
                                    <p className="text-[11px] text-ink-muted">{row.docType}</p>
                                  </td>
                                  <td className="py-3 px-3">
                                    {isDup ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-expense-soft text-expense font-semibold text-[11px]">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>สลิปซ้ำ (0 เครดิต)</span>
                                      </span>
                                    ) : (
                                      <span className="text-ink-secondary">{row.category}</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-[11px] tabular-nums text-ink-secondary">
                                    {row.refId}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono tabular-nums text-ink-secondary">
                                    {row.vat > 0 ? row.vat.toFixed(2) : '-'}
                                  </td>
                                  <td
                                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                                      isDup
                                        ? 'line-through text-ink-muted'
                                        : row.direction === 'income'
                                          ? 'text-sky'
                                          : 'text-expense'
                                    }`}
                                  >
                                    {row.direction === 'income' ? '+' : row.direction === 'expense' ? '-' : ''}
                                    {row.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {workbenchTab === 'summary' && (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-muted/50 text-ink-secondary">
                              <th className="py-2.5 px-4 font-semibold">รายการสรุปงบการเงิน (Sheet 1: Summary)</th>
                              <th className="py-2.5 px-4 font-semibold text-right">จำนวนบิล</th>
                              <th className="py-2.5 px-4 font-semibold text-right">มูลค่าก่อนภาษี (฿)</th>
                              <th className="py-2.5 px-4 font-semibold text-right">ภาษีมูลค่าเพิ่ม 7% (฿)</th>
                              <th className="py-2.5 px-4 font-semibold text-right">จำนวนเงินสุทธิ (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="py-3 px-4 font-medium text-ink">รายรับรวมที่ยืนยันแล้ว (Confirmed Income)</td>
                              <td className="py-3 px-4 text-right tabular-nums">2 รายการ</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">8,157.00</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">0.00</td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-sky tabular-nums">+8,157.00</td>
                            </tr>
                            <tr>
                              <td className="py-3 px-4 font-medium text-ink">รายจ่ายรวมที่ยืนยันแล้ว (Confirmed Expense)</td>
                              <td className="py-3 px-4 text-right tabular-nums">2 รายการ</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">3,600.00</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-expense">252.00</td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-expense tabular-nums">-3,852.00</td>
                            </tr>
                            <tr className="bg-surface-muted/40">
                              <td className="py-3 px-4 font-medium text-ink-muted">รายการสลิปซ้ำที่ถูกคัดออกอัตโนมัติ (Excluded Duplicate)</td>
                              <td className="py-3 px-4 text-right tabular-nums text-ink-muted">1 รายการ</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-muted">0.00</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-muted">0.00</td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-muted">0.00 (ไม่หักเครดิต)</td>
                            </tr>
                            <tr className="bg-brand-soft/30 font-semibold">
                              <td className="py-3.5 px-4 text-brand">ยอดคงเหลือสุทธิประจำงวด (Net Cashflow)</td>
                              <td className="py-3.5 px-4 text-right tabular-nums text-brand">4 รายการจริง</td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-brand">4,557.00</td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-expense">-252.00</td>
                              <td className="py-3.5 px-4 text-right font-mono text-brand tabular-nums mm-double-rule-navy">+4,305.00</td>
                            </tr>
                          </tbody>
                        </table>
                      )}

                      {workbenchTab === 'income' && (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-muted/50 text-ink-secondary">
                              <th className="py-2.5 px-4 font-semibold">วันที่รับเงิน</th>
                              <th className="py-2.5 px-4 font-semibold">ผู้โอน → บัญชีรับเงิน</th>
                              <th className="py-2.5 px-4 font-semibold">ธนาคาร</th>
                              <th className="py-2.5 px-4 font-semibold">รหัสอ้างอิงสลิป</th>
                              <th className="py-2.5 px-4 font-semibold text-right">ยอดเงินเข้า (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {DEMO_SLIP_SAMPLES.filter((s) => s.direction === 'income').map((s) => (
                              <tr key={s.id}>
                                <td className="py-3 px-4 tabular-nums">{s.date} ({s.time})</td>
                                <td className="py-3 px-4 font-medium text-ink">{formatPartyName(s.party)}</td>
                                <td className="py-3 px-4 text-ink-secondary">{s.bank}</td>
                                <td className="py-3 px-4 font-mono tabular-nums">{s.refId}</td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-sky tabular-nums">
                                  +{s.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {workbenchTab === 'expense' && (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-muted/50 text-ink-secondary">
                              <th className="py-2.5 px-4 font-semibold">วันที่ใบกำกับภาษี</th>
                              <th className="py-2.5 px-4 font-semibold">ชื่อผู้ขาย / ผู้ออกบิล</th>
                              <th className="py-2.5 px-4 font-semibold text-right">มูลค่าก่อน VAT (฿)</th>
                              <th className="py-2.5 px-4 font-semibold text-right">ภาษีซื้อ VAT 7% (฿)</th>
                              <th className="py-2.5 px-4 font-semibold text-right">ยอดรวมสุทธิ (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {DEMO_SLIP_SAMPLES.filter((s) => s.direction === 'expense').map((s) => (
                              <tr key={s.id}>
                                <td className="py-3 px-4 tabular-nums">{s.date}</td>
                                <td className="py-3 px-4 font-medium text-ink">{s.party}</td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums">{s.subtotal.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-expense tabular-nums">
                                  {s.vat.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-ink tabular-nums">
                                  -{s.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {workbenchTab === 'category' && (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-muted/50 text-ink-secondary">
                              <th className="py-2.5 px-4 font-semibold">หมวดหมู่ทางบัญชี</th>
                              <th className="py-2.5 px-4 font-semibold">ประเภท</th>
                              <th className="py-2.5 px-4 font-semibold text-right">จำนวนรายการ</th>
                              <th className="py-2.5 px-4 font-semibold text-right">ยอดรวมหมวดหมู่ (฿)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="py-3 px-4 font-medium text-ink">รายได้จากการขายสินค้าและบริการ</td>
                              <td className="py-3 px-4 text-sky font-semibold">รายรับ</td>
                              <td className="py-3 px-4 text-right tabular-nums">2 รายการ</td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-sky tabular-nums">8,157.00</td>
                            </tr>
                            <tr>
                              <td className="py-3 px-4 font-medium text-ink">ค่าวัตถุดิบและวัสดุสิ้นเปลือง</td>
                              <td className="py-3 px-4 text-expense font-semibold">รายจ่าย</td>
                              <td className="py-3 px-4 text-right tabular-nums">1 รายการ</td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-expense tabular-nums">2,675.00</td>
                            </tr>
                            <tr>
                              <td className="py-3 px-4 font-medium text-ink">ค่าขนส่งพัสดุ</td>
                              <td className="py-3 px-4 text-expense font-semibold">รายจ่าย</td>
                              <td className="py-3 px-4 text-right tabular-nums">1 รายการ</td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-expense tabular-nums">1,177.00</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Spreadsheet Bottom Accounting Totals Bar */}
                  <div className="p-4 bg-surface-muted border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex flex-wrap items-center gap-6">
                      <div>
                        <span className="text-ink-muted block">รายรับยืนยันแล้ว</span>
                        <span className="font-mono font-bold text-sm text-sky tabular-nums">
                          +฿{confirmedIncomeTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">รายจ่ายรวม (รวมภาษีซื้อ ฿{confirmedVatTotal.toFixed(2)})</span>
                        <span className="font-mono font-bold text-sm text-expense tabular-nums">
                          -฿{confirmedExpenseTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">ยอดคงเหลือสุทธิ (Net)</span>
                        <span className="font-mono font-bold text-sm text-brand tabular-nums mm-double-rule-red">
                          +฿{netBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <a
                      href="/api/export/excel"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-inner bg-surface border border-border-strong font-semibold text-ink hover:bg-brand-soft hover:text-brand mm-interactive"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-sky" />
                      <span>ดาวน์โหลดไฟล์ตัวอย่าง .xlsx (5 ชีต)</span>
                    </a>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* SECTION 2: ARCHITECTURAL ACCOUNTING SPECIFICATION LEDGER (Not icon cards!) */}
        <section id="accounting-rules" className="py-16 sm:py-20 border-b border-border bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                  เกณฑ์การคัดแยกทางบัญชีและการตัดเครดิตของระบบ
                </h2>
                <p className="text-sm text-ink-secondary">
                  ทุกรูปที่อัปโหลดเข้าสู่ระบบจะถูกคัดกรองตามเงื่อนไขทางบัญชี 4 ข้อด้านล่าง เพื่อให้ยอดคงเหลือในสมุดรายวันตรงกับเงินในบัญชีธนาคารจริงของร้าน
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/sticker-phone.png"
                  alt="จัดการการเงินกับ MoneyMate"
                  width={56}
                  height={56}
                  loading="lazy"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <span className="text-xs text-ink-secondary max-w-[26ch]">
                  ตั้งค่าเลขบัญชีร้านเพียงครั้งเดียวที่เมนูตั้งค่าธุรกิจ
                </span>
              </div>
            </div>

            <div className="border border-border-strong rounded-outer overflow-hidden">
              <div className="hidden md:grid md:grid-cols-12 bg-surface-muted px-6 py-3 border-b border-border text-xs font-semibold text-ink-secondary">
                <div className="col-span-3">สถานการณ์ของเอกสารที่อัปโหลด</div>
                <div className="col-span-4">วิธีที่ระบบตรวจสอบข้อมูล</div>
                <div className="col-span-3">การบันทึกในสมุดรายวันและงบ Excel</div>
                <div className="col-span-2 text-right">การคิดเครดิต</div>
              </div>

              <div className="divide-y divide-border text-sm">
                {ACCOUNTING_RULES.map((rule) => (
                  <div
                    key={rule.situation}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 sm:px-6 py-5 items-start hover:bg-background/60"
                  >
                    <div className="md:col-span-3 font-semibold text-ink">
                      {rule.situation}
                    </div>
                    <div className="md:col-span-4 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                      {rule.mechanism}
                    </div>
                    <div className="md:col-span-3 text-xs sm:text-sm text-ink leading-relaxed">
                      {rule.outcome}
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-xs font-semibold tabular-nums ${
                          rule.creditRule.startsWith('0')
                            ? 'bg-sky-soft text-sky'
                            : 'bg-surface-muted text-ink'
                        }`}
                      >
                        {rule.creditRule}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SPLIT WORKSHEET — 7% VAT CALCULATOR & MONTHLY SLIP COST ESTIMATOR */}
        <section id="vat-worksheet" className="py-16 sm:py-20 border-b border-border bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left 6 Cols: Interactive 7% VAT Tax Invoice Worksheet */}
              <div className="lg:col-span-6 bg-surface border border-border-strong rounded-outer p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <h2 className="text-xl font-display font-semibold text-ink">
                      กระดาษทำการคำนวณและถอดภาษี VAT 7%
                    </h2>
                    <p className="text-xs text-ink-secondary mt-0.5">
                      ใช้ตรวจทานยอดก่อนภาษีและภาษีมูลค่าเพิ่ม 7% จากใบกำกับภาษี
                    </p>
                  </div>
                  <Link
                    href="/tools/vat-calculator"
                    className="text-xs font-semibold text-brand hover:underline shrink-0"
                  >
                    เปิดหน้าคำนวณเต็มจอ
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-muted rounded-inner text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setVatMode('extract')}
                    className={`py-2 rounded text-center mm-interactive ${
                      vatMode === 'extract'
                        ? 'bg-surface text-brand font-semibold shadow-2xs'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    ถอด VAT 7% จากราคารวมภาษีแล้ว
                  </button>
                  <button
                    type="button"
                    onClick={() => setVatMode('add')}
                    className={`py-2 rounded text-center mm-interactive ${
                      vatMode === 'add'
                        ? 'bg-surface text-brand font-semibold shadow-2xs'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    บวก VAT 7% เพิ่มจากราคาก่อนภาษี
                  </button>
                </div>

                <div>
                  <label htmlFor="vat-amount-input" className="block text-xs font-semibold text-ink mb-1.5">
                    ระบุจำนวนเงินตามหน้าบิล (บาท)
                  </label>
                  <input
                    id="vat-amount-input"
                    type="number"
                    value={vatInputAmount}
                    onChange={(e) => setVatInputAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-inner border border-border-strong font-mono font-bold text-lg text-ink tabular-nums"
                  />
                </div>

                <dl className="divide-y divide-border border border-border rounded-inner bg-background text-xs">
                  <div className="px-4 py-3 flex justify-between items-center">
                    <dt className="text-ink-secondary">มูลค่าสินค้าหรือบริการก่อนภาษี (Subtotal)</dt>
                    <dd className="font-mono font-semibold text-sm text-ink tabular-nums">
                      ฿{formatTHB(vatBase)}
                    </dd>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <dt className="text-ink-secondary">ภาษีมูลค่าเพิ่ม 7% (VAT)</dt>
                    <dd className="font-mono font-semibold text-sm text-expense tabular-nums">
                      ฿{formatTHB(vatSeven)}
                    </dd>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center bg-surface">
                    <dt className="font-semibold text-ink">ยอดเงินรวมสุทธิ (Grand Total)</dt>
                    <dd className="font-mono font-bold text-base text-brand tabular-nums mm-double-rule-navy">
                      ฿{formatTHB(vatGrandTotal)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Right 6 Cols: Slip Volume & Time Estimator */}
              <div className="lg:col-span-6 bg-surface border border-border-strong rounded-outer p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/brand/sticker-plan.png"
                      alt="วางแผนต้นทุนร้านค้า"
                      width={48}
                      height={48}
                      loading="lazy"
                      className="w-12 h-12 object-contain shrink-0"
                    />
                    <div>
                      <h2 className="text-xl font-display font-semibold text-ink">
                        ประเมินเวลาทำงานและค่าเครดิตตามปริมาณบิล
                      </h2>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        เลื่อนปรับจำนวนสลิปต่อเดือนเพื่อเทียบเวลานั่งคีย์เองกับต้นทุนเครดิตจริง
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-baseline">
                    <label htmlFor="monthly-slips-slider" className="text-xs font-semibold text-ink">
                      จำนวนสลิปและใบเสร็จของร้านต่อเดือน
                    </label>
                    <span className="font-mono font-bold text-xl text-brand tabular-nums">
                      {monthlySlips.toLocaleString()} ใบ / เดือน
                    </span>
                  </div>
                  <input
                    id="monthly-slips-slider"
                    type="range"
                    min="20"
                    max="1500"
                    step="20"
                    value={monthlySlips}
                    onChange={(e) => setMonthlySlips(Number(e.target.value))}
                    className="w-full accent-brand h-2 bg-border rounded-lg cursor-pointer"
                  />
                </div>

                <dl className="divide-y divide-border border border-border rounded-inner bg-background text-xs">
                  <div className="px-4 py-3 flex justify-between items-center">
                    <dt className="text-ink-secondary">เวลาที่ใช้หากนั่งเปิดดูและคีย์ลง Excel เอง (เฉลี่ย 1.5 นาที/ใบ)</dt>
                    <dd className="font-mono font-semibold text-sm text-ink tabular-nums">
                      {manualHoursSaved} ชั่วโมง / เดือน
                    </dd>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <dt className="text-ink-secondary">เวลาที่ใช้เมื่ออัปโหลดแบบ Batch เข้า MoneyMate</dt>
                    <dd className="font-mono font-semibold text-sm text-sky tabular-nums">
                      ประมาณ {Math.max(1, Math.round(monthlySlips / 60))} นาที / เดือน
                    </dd>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center bg-surface">
                    <dt className="font-semibold text-ink">ค่าเครดิตเฉลี่ยต่อเดือน (คำนวณที่อัตรา 0.39 บาท/รูป)</dt>
                    <dd className="font-mono font-bold text-base text-brand tabular-nums">
                      ฿{estimatedCreditCost.toLocaleString()} / เดือน
                    </dd>
                  </div>
                </dl>
              </div>

            </div>
          </div>
        </section>

        {/* SECTION 4: PAY-AS-YOU-GO CREDIT RATE SCHEDULE */}
        <section id="pricing" className="py-16 sm:py-20 border-b border-border bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                  ตารางอัตราค่าตั๋วเครดิต (เติมตามที่ใช้จริง ไม่มีค่ารายเดือน)
                </h2>
                <p className="text-sm text-ink-secondary">
                  เครดิตทุกแพ็กเกจไม่มีวันหมดอายุ หัก 1 เครดิตเฉพาะรูปสลิปหรือใบเสร็จที่อ่านสำเร็จและไม่ซ้ำเท่านั้น ชำระเงินผ่าน QR PromptPay และรับเครดิตเข้ากระเป๋าทันที
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/sticker-saving.png"
                  alt="ออมเงินกับแพ็กเกจเครดิต"
                  width={56}
                  height={56}
                  loading="lazy"
                  className="w-14 h-14 object-contain shrink-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 border border-border-strong rounded-outer overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
              
              {/* Tier 1: Free Trial */}
              <div className="p-6 sm:p-7 flex flex-col justify-between bg-surface space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-display font-semibold text-base text-ink">
                      โควตาทดลองใช้งาน (Free Trial)
                    </h3>
                    <span className="text-xs font-medium text-ink-muted">เริ่มต้น</span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-ink tabular-nums">฿0</span>
                    <span className="text-xs text-ink-muted">รับทันที 5 เครดิต</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-ink-secondary pt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>สแกนสลิปหรือใบกำกับภาษีได้ 5 รูป</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>ระบบตรวจสลิปซ้ำ 2 ชั้น ไม่หักเครดิต</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>ดาวน์โหลดรายงาน Excel 5 ชีตและ CSV</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/register"
                  className="w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-ink bg-surface border border-border-strong hover:bg-surface-muted rounded-inner mm-interactive"
                >
                  สร้างบัญชีรับฟรี 5 เครดิต
                </Link>
              </div>

              {/* Tier 2: Starter 100 */}
              <div className="p-6 sm:p-7 flex flex-col justify-between bg-background/70 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-display font-semibold text-base text-brand">
                      ตั๋วร้านค้าเริ่มต้น (Starter 100)
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-expense text-white text-[11px] font-semibold">
                      เฉลี่ย 0.59 บาท/รูป
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-brand tabular-nums">฿59</span>
                    <span className="text-xs text-ink-secondary">/ 100 เครดิต (ไม่หมดอายุ)</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-ink pt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>โควตาสแกนสลิปและใบเสร็จ 100 รูป</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>แยกรายรับ-รายจ่ายตามเลขบัญชีร้านอัตโนมัติ</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>ถอดยอดภาษีซื้อ VAT 7% พร้อมออก Excel 5 ชีต</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/app/checkout?package=STARTER"
                  className="w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-white bg-expense hover:opacity-95 rounded-inner mm-interactive"
                >
                  เติมตั๋ว 59 บาท (100 เครดิต)
                </Link>
              </div>

              {/* Tier 3: Business 500 */}
              <div className="p-6 sm:p-7 flex flex-col justify-between bg-surface space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-display font-semibold text-base text-ink">
                      ตั๋วร้านค้าขายดี (Business 500)
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-brand-soft text-brand text-[11px] font-semibold">
                      เฉลี่ย 0.39 บาท/รูป
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-ink tabular-nums">฿199</span>
                    <span className="text-xs text-ink-secondary">/ 500 เครดิต (ไม่หมดอายุ)</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-ink-secondary pt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>โควตาสแกนสลิปและใบเสร็จ 500 รูป</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>อัปโหลดพร้อมกันได้สูงสุด 100 รูปต่อรอบ</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
                      <span>สรุปภาษีซื้อ-ภาษีขายเตรียมยื่นแบบ ภ.พ.30</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/app/checkout?package=BUSINESS"
                  className="w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-inner mm-interactive"
                >
                  เติมตั๋ว 199 บาท (500 เครดิต)
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* SECTION 5: ASYMMETRIC 2-COLUMN FAQ LEDGER */}
        <section id="faq" className="py-16 sm:py-20 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              
              <div className="lg:col-span-4 space-y-4">
                <Image
                  src="/brand/sticker-hmm.png"
                  alt="คำถามที่พบบ่อยเกี่ยวกับการใช้งาน"
                  width={68}
                  height={68}
                  loading="lazy"
                  className="w-16 h-16 object-contain"
                />
                <h2 className="text-2xl sm:text-3xl font-display font-semibold text-ink">
                  คำถามที่พบบ่อยเกี่ยวกับการอ่านสลิปและการคิดเครดิต
                </h2>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  รายละเอียดการตรวจสอบสลิปซ้ำ การผูกเลขบัญชีธนาคารของร้าน และการส่งออกไฟล์งบการเงิน
                </p>
              </div>

              <div className="lg:col-span-8 divide-y divide-border border border-border-strong rounded-outer bg-surface overflow-hidden">
                {FAQS.map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={faq.q}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="w-full px-5 sm:px-6 py-4 text-left text-sm font-semibold text-ink flex items-center justify-between gap-4 hover:bg-surface-muted/60 mm-interactive"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-ink-muted shrink-0 mm-interactive ${
                            isOpen ? 'rotate-180 text-brand' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* ARCHITECTURAL FOOTER */}
      <footer className="bg-surface border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
            <div className="space-y-3">
              <Image
                src="/brand/logo-header.png?v=3"
                alt="MoneyMate"
                width={140}
                height={36}
                loading="lazy"
                className="h-8 w-auto object-contain"
              />
              <p className="text-ink-secondary leading-relaxed">
                MoneyMate (เพื่อนช่วยจัดการเงิน) ระบบแปลงภาพสลิปธนาคารและใบกำกับภาษีเป็นสมุดรายวันและรายงาน Excel 5 ชีตสำหรับร้านค้าออนไลน์
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-ink">การใช้งานหลัก</p>
              <ul className="space-y-1.5 text-ink-secondary">
                <li><a href="#workbench" className="hover:text-brand">สมุดรายวันและตารางตัวอย่าง</a></li>
                <li><a href="#accounting-rules" className="hover:text-brand">เกณฑ์การคัดแยกรายรับ-รายจ่าย</a></li>
                <li><a href="#vat-worksheet" className="hover:text-brand">กระดาษทำการคำนวณ VAT 7%</a></li>
                <li><a href="#pricing" className="hover:text-brand">ตารางอัตราค่าตั๋วเครดิต</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-ink">พอร์ทัลระบบ</p>
              <ul className="space-y-1.5 text-ink-secondary">
                <li><Link href="/app/dashboard" className="hover:text-brand">แดชบอร์ดร้านค้า (/app/dashboard)</Link></li>
                <li><Link href="/app/upload" className="hover:text-brand">อัปโหลดสลิปแบบ Batch (/app/upload)</Link></li>
                <li><Link href="/tools/vat-calculator" className="hover:text-brand">โปรแกรมถอด VAT 7% ฟรี</Link></li>
                <li><Link href="/admin/dashboard" className="hover:text-brand">พอร์ทัลผู้ดูแลระบบ (/admin)</Link></li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-ink">มาตรฐานข้อมูลและความปลอดภัย</p>
              <p className="text-ink-secondary leading-relaxed">
                จัดเก็บเอกสารใน Private Storage แยกสิทธิ์ตามบัญชีผู้ใช้งาน และรองรับการสั่งลบภาพสลิปต้นฉบับตามมาตรฐานการคุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
            <p>© 2026 MoneyMate (เพื่อนช่วยจัดการเงิน)</p>
            <div className="flex items-center gap-5">
              <Link href="/login" className="hover:text-ink">เข้าสู่ระบบ</Link>
              <Link href="/register" className="hover:text-ink">สร้างบัญชีใหม่</Link>
              <Link href="/tools/vat-calculator" className="hover:text-ink">คำนวณภาษีมูลค่าเพิ่ม</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
