# คู่มือนักพัฒนาและการตั้งค่าระบบ (DEVELOPER GUIDE — Step-by-Step)

เอกสารนี้อธิบายโครงสร้างโค้ดและขั้นตอนการตั้งค่าระบบ **MoneyMate (เพื่อนช่วยจัดการเงิน)** แบบ Step-by-Step เพื่อให้คุณสามารถนำระบบไปเชื่อมต่อกับ Production Services (Supabase, Google Gemini API, Payment Gateway และ Vercel) ได้ทันที

> **หมายเหตุสำคัญสำหรับการทดสอบในเครื่อง (Local Sandbox Mode)**:
> ระบบมี **Local Persistent Repository (`src/lib/supabase/repository.ts`)** และ **Heuristic Multimodal Fallback (`src/lib/ai/gemini-extractor.ts`)** ในตัว ทำให้สามารถรัน `npm run dev` และทดสอบทุกฟีเจอร์ (ทั้งฝั่งลูกค้า `/app/*` และฝั่งแอดมิน `/admin/*` รวมถึงจำลองยิง PromptPay Webhook) ได้ทันทีแม้ยังไม่ได้ใส่ API Key จริง

---

## 1. โครงสร้างโฟลเดอร์ (Folder Structure)

```text
moneymate/
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema_and_rls.sql   # ตารางทั้ง 12 ตาราง + RLS Policies + Triggers
│       ├── 0002_rpc_atomic_functions.sql     # Stored Procedures ตัดเครดิต/รับชำระเงินแบบ Atomic
│       └── 0003_seed_data.sql                # หมวดหมู่มาตรฐาน + แพ็กเกจราคา + Private Storage Bucket
├── src/
│   ├── app/
│   │   ├── (public)/                         # หน้าแรก (/), /tools/vat-calculator, /login, /register
│   │   ├── app/                              # Customer Portal (/app/dashboard, /upload, /transactions ฯลฯ)
│   │   ├── admin/                            # Super Admin Portal (/admin/dashboard, /users, /audit-logs ฯลฯ)
│   │   └── api/                              # Next.js Route Handlers (Auth, Upload, Process, Export, Webhook)
│   ├── lib/
│   │   ├── ai/                               # Google Gemini (@google/genai) + JSON Schema Validation
│   │   ├── analytics/                        # สูตรคำนวณ Dashboard รายรับ-รายจ่าย และภาษีมูลค่าเพิ่ม
│   │   ├── classification/                   # Context-Aware Classifier + 2-Tier Duplicate Detector
│   │   ├── credits/                          # Wallet Service เชื่อมต่อ Atomic RPC
│   │   ├── export/                           # ExcelJS 5-Sheet Builder (.xlsx) + UTF-8 BOM CSV
│   │   ├── payments/                         # PromptPay QR Adapter + HMAC-SHA256 Webhook Verifier
│   │   ├── security/                         # HMAC Signed Session, Anonymous Trial Quota, Rate Limiter
│   │   └── supabase/                         # Supabase SSR Client, Admin Service Role, Local Repository
│   └── middleware.ts                         # Server-side RBAC Guard (/app/* vs /admin/* + MFA check)
└── tests/
    └── moneymate.test.ts                     # ชุดทดสอบอัตโนมัติ (Unit & Integration Tests)
```

---

## 2. ขั้นตอนที่ 1: ตั้งค่าฐานข้อมูลและ Private Storage บน Supabase

1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard) และกด **New Project**
2. เมื่อสร้างโปรเจกต์เสร็จ ให้ไปที่เมนู **SQL Editor** ด้านซ้าย
3. รันไฟล์ SQL ตามลำดับดังนี้:
   - เปิดไฟล์ `supabase/migrations/0001_initial_schema_and_rls.sql` คัดลอกโค้ดทั้งหมดวางใน SQL Editor แล้วกด **Run** (ขั้นตอนนี้จะสร้างตารางทั้ง 12 ตาราง, เปิดใช้งาน Row Level Security ทุกตาราง และสร้าง Trigger ป้องกันการแก้ `role` ตัวเอง รวมถึง Trigger แจกฟรี 30 เครดิตเมื่อสมัครสมาชิกใหม่)
   - เปิดไฟล์ `supabase/migrations/0002_rpc_atomic_functions.sql` คัดลอกและกด **Run** (สร้างฟังก์ชัน Atomic: `deduct_credit_for_job`, `fulfill_payment_order_webhook`, `admin_adjust_user_credits`)
   - เปิดไฟล์ `supabase/migrations/0003_seed_data.sql` คัดลอกและกด **Run** (สร้างหมวดหมู่เริ่มต้น 9 หมวดหมู่, แพ็กเกจ `FREE`/`STARTER`/`BUSINESS` และสร้าง Private Storage Bucket ชื่อ `documents`)
4. ไปที่เมนู **Project Settings > API** แล้วคัดลอกค่าต่อไปนี้มาใส่ในไฟล์ `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL ของคุณ
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` `secret` key *(ห้ามเปิดเผยฝั่ง Client เด็ดขาด)*

---

## 3. ขั้นตอนที่ 2: การตั้งค่าสิทธิ์ `super_admin` และการเปิด MFA

เพื่อความปลอดภัยสูงสุด ระบบไม่อนุญาตให้ผู้ใช้เปลี่ยน `role` ของตนเองผ่านหน้าเว็บ การตั้งค่าผู้ดูแลระบบคนแรก (`super_admin`) ต้องทำผ่าน Supabase SQL Editor เท่านั้น:

1. สมัครสมาชิกผ่านหน้า `/register` ด้วยอีเมลที่คุณต้องการใช้เป็นแอดมิน (เช่น `owner@yourcompany.com`)
2. เปิดใช้งาน **Multi-Factor Authentication (MFA / TOTP)** ในบัญชีของคุณ
3. ไปที่ **Supabase Dashboard > SQL Editor** แล้วรันคำสั่งต่อไปนี้:

```sql
UPDATE public.profiles
SET role = 'super_admin',
    updated_at = NOW()
WHERE email = 'owner@yourcompany.com';
```

4. เมื่อ Login อีกครั้ง ระบบจะตรวจสอบ Role และสถานะ MFA ฝั่ง Server แล้วพาท่านเข้าสู่ `/admin/dashboard` โดยอัตโนมัติ

---

## 4. ขั้นตอนที่ 3: ตั้งค่า Google Gemini API (`@google/genai`)

1. ไปที่ [Google AI Studio](https://aistudio.google.com/app/apikey) และกด **Create API Key**
2. นำคีย์ที่ได้ไปใส่ใน `.env.local`:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualGeminiKeyHere
   GEMINI_MODEL=gemini-3.8-flash
   ```
3. ระบบใช้ SDK รุ่นปัจจุบัน `@google/genai` (`client.interactions.create`) พร้อม `response_format` แบบ JSON Schema ที่บังคับโครงสร้างผลลัพธ์อย่างเคร่งครัด

---

## 5. ขั้นตอนที่ 4: ตั้งค่า PromptPay QR Payment Gateway และ Webhook

ระบบออกแบบด้วย **Adapter Pattern (`src/lib/payments/adapter.ts`)** รองรับการเชื่อมต่อกับผู้ให้บริการชำระเงินในไทย เช่น **GB Prime Pay** หรือ **Opn Payments (Omise)**:

1. สมัครบัญชีร้านค้ากับผู้ให้บริการชำระเงิน และเปิดใช้งานบริการ **PromptPay QR Payment**
2. ตั้งค่า **Webhook Endpoint URL** ในหน้า Dashboard ของผู้ให้บริการให้ชี้มาที่:
   ```text
   https://your-domain.com/api/webhooks/payment
   ```
3. นำค่า Merchant ID, API Key และ Webhook Signing Secret มาใส่ใน `.env.local`:
   ```env
   PAYMENT_PROVIDER=gbprimepay
   PAYMENT_MERCHANT_ID=your_merchant_id
   PAYMENT_API_KEY=your_api_key
   PAYMENT_WEBHOOK_SECRET=your_webhook_hmac_secret_min_32_chars
   ```
4. ทุกครั้งที่ผู้ให้บริการยิง Webhook เข้ามาที่ `/api/webhooks/payment`:
   - ระบบจะตรวจสอบลายเซ็น `x-moneymate-signature` ด้วยอัลกอริทึม **HMAC-SHA256 (`timingSafeEqual`)**
   - ตรวจสอบยอดเงิน (`amount_thb`) ว่าตรงกับ `payment_orders`
   - เรียก Stored Procedure `fulfill_payment_order_webhook` ซึ่งล็อกแถวด้วย `FOR UPDATE` ป้องกันการเติมเครดิตซ้ำ 100%

---

## 6. ขั้นตอนที่ 5: การรันทดสอบและนำขึ้นระบบจริง (Deployment บน Vercel)

### การตรวจสอบคุณภาพโค้ดก่อน Deploy
```bash
# 1. รัน Unit & Integration Tests ทั้งหมด
npm test

# 2. ตรวจสอบการ Build สำหรับ Production
npm run build
```

### ขั้นตอนการ Deploy ขึ้น Vercel
1. อัปโหลดโค้ดขึ้น GitHub Repository ของคุณ
2. ไปที่ [Vercel Dashboard](https://vercel.com/new) และเลือก **Import Git Repository**
3. ในหัวข้อ **Environment Variables** ให้คัดลอกค่าทั้งหมดจาก `.env.example` ไปใส่ให้ครบถ้วน:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (`gemini-3.8-flash`)
   - `TRIAL_COOKIE_SECRET` (ตั้งรหัสสุ่มความยาวอย่างน้อย 32 ตัวอักษร)
   - `PAYMENT_WEBHOOK_SECRET` (ตั้งรหัสสุ่มความยาวอย่างน้อย 32 ตัวอักษร)
4. กด **Deploy** — เมื่อเสร็จสิ้น เว็บไซต์ของคุณจะพร้อมใช้งานทันทีพร้อมระบบ SSL, Sitemap (`/sitemap.xml`) และ Robots (`/robots.txt`)
