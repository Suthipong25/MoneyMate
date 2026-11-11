# MoneyMate (เพื่อนช่วยจัดการเงิน) — AI-Powered Income & Expense SaaS

**MoneyMate** คือระบบเว็บแอปพลิเคชันแบบ Full-Stack Multi-Role SaaS สำหรับจัดการรายรับ-รายจ่าย อ่านสลิปโอนเงิน ใบเสร็จรับเงิน และใบกำกับภาษีด้วย **Google Gemini Multimodal AI (`@google/genai`)** พร้อมระบบตรวจจับสลิปซ้ำ 2 ชั้น (2-Tier Duplicate Detection), ถอดภาษีมูลค่าเพิ่ม (VAT 7%), ระบบตัดเครดิตแบบ Atomic และส่งออกงบการเงินเป็นไฟล์ Excel (`.xlsx`) 5 แผ่นงานพร้อมสูตรคำนวณอัตโนมัติ

---

## โครงสร้างหลักของระบบ (Core Architecture)

1. **Multi-Role Architecture (แยก 2 พอร์ทัลชัดเจน)**:
   - **Customer Portal (`/app/*`)**: แดชบอร์ดการเงิน, อัปโหลดสลิปเป็นชุด (Batch Queue สูงสุด 100 รูป), ตรวจสอบผลลัพธ์ AI, รายการเดินบัญชี, หมวดหมู่, รายงานการเงิน & ภาษี, เติมเครดิตผ่าน PromptPay QR และตั้งค่าข้อมูลธุรกิจ
   - **Super Admin Portal (`/admin/*`)**: ภาพรวม KPI 7 ตัวชี้วัด, จัดการผู้ใช้งาน (ระงับ/เปิดบัญชี), ปรับเครดิตลูกค้าพร้อมบังคับระบุเหตุผลลง `audit_logs`, จัดการคำสั่งซื้อ/คืนเงิน, จัดการแพ็กเกจราคา, ตรวจสอบคิวงาน AI (Force Retry) และดูบันทึก Audit Logs ย้อนหลัง
   - **Public & SEO Pages (`/`, `/tools/vat-calculator`, `/login`, `/register`)**: หน้าแรกพร้อม Interactive Live Demo ทดลองสแกนฟรี 5 รูป (Signed Cookie + IP Anti-Reset), เครื่องคำนวณความคุ้มค่า (ROI Slider) และเครื่องคำนวณ VAT 7% ฟรีพร้อม JSON-LD Schema

2. **Database, RLS & Atomic Transactions (`supabase/migrations/`)**:
   - ออกแบบตาราง PostgreSQL ครบ 12 ตาราง พร้อมเปิด **Row Level Security (RLS)** ทุกตาราง
   - Stored Procedures (`SECURITY DEFINER` + `FOR UPDATE` Row Lock) สำหรับตัดเครดิต (`deduct_credit_for_job`), รับชำระเงินผ่าน Webhook (`fulfill_payment_order_webhook`) และปรับเครดิตโดยแอดมิน (`admin_adjust_user_credits`)

3. **AI Multimodal & Context-Aware Classification (`src/lib/ai/` & `src/lib/classification/`)**:
   - ใช้ `@google/genai` (`client.interactions.create` + JSON Schema) อ่านข้อมูลจากสลิป/ใบเสร็จ/ใบกำกับภาษี
   - จำแนกทิศทางธุรกรรม (`income`, `expense`, `internal_transfer`, `needs_review`) โดยเทียบกับชื่อบัญชีและเลขบัญชีของธุรกิจที่ตั้งค่าไว้

4. **ExcelJS 5-Sheet Financial Export (`src/lib/export/excel-builder.ts`)**:
   - สร้างไฟล์ `.xlsx` 5 แผ่นงาน (`Summary`, `Income`, `Expense`, `Transactions`, `Categories`) พร้อมสูตร `=B3-B4` และ `SUM()`, จัดรูปแบบตัวเลขสกุลเงิน และรองรับการเปิดใน Microsoft Excel ภาษาไทย

---

## เริ่มต้นใช้งานอย่างรวดเร็ว (Quick Start)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. คัดลอกไฟล์ตัวแปรสภาพแวดล้อม
cp .env.example .env.local

# 3. รันชุดทดสอบอัตโนมัติ (Unit & Integration Tests)
npm test

# 4. รันเซิร์ฟเวอร์พัฒนา (Development Server)
npm run dev
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

### บัญชีทดสอบ (Demo Credentials สำหรับทดสอบทันที)
- **ลูกค้าทั่วไป (Customer Portal -> `/app/dashboard`)**: `demo@moneymate.co.th`
- **ผู้ดูแลระบบสูงสุด (Super Admin Portal + MFA Verified -> `/admin/dashboard`)**: `admin@moneymate.co.th`

---

## เอกสารประกอบในโปรเจกต์
- [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md): คู่มือนักพัฒนาและการตั้งค่า Supabase, Gemini API, PromptPay Webhook และการ Deploy ขึ้น Vercel แบบ Step-by-Step
- [`USER_MANUAL.md`](./USER_MANUAL.md): คู่มือการใช้งานฉบับสมบูรณ์สำหรับลูกค้า (`/app`) และผู้ดูแลระบบ (`/admin`)
- [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md): รายงานผลการตรวจสอบความปลอดภัยตามมาตรฐาน OWASP Web, AI/LLM Security และ Supply Chain
