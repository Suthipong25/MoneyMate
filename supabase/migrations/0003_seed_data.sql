-- =============================================================================
-- MoneyMate — Migration 0003: Seed Default Categories, Packages & Storage Policies
-- =============================================================================

-- 1. SEED DEFAULT INCOME & EXPENSE CATEGORIES
INSERT INTO public.categories (user_id, name, direction, color_hex, is_default, is_active)
VALUES
  -- รายรับ (Income)
  (NULL, 'รายได้จากการขาย', 'income', '#15803D', TRUE, TRUE),
  (NULL, 'รายได้จากบริการ', 'income', '#0D9488', TRUE, TRUE),
  (NULL, 'รายได้อื่นๆ', 'income', '#16A34A', TRUE, TRUE),
  -- รายจ่าย (Expense)
  (NULL, 'ค่าอาหาร', 'expense', '#DC2626', TRUE, TRUE),
  (NULL, 'ค่าวัตถุดิบ', 'expense', '#EA580C', TRUE, TRUE),
  (NULL, 'ค่าขนส่ง', 'expense', '#D97706', TRUE, TRUE),
  (NULL, 'ค่าโฆษณา', 'expense', '#7C3AED', TRUE, TRUE),
  (NULL, 'ค่าสาธารณูปโภค', 'expense', '#2563EB', TRUE, TRUE),
  (NULL, 'ค่าเดินทาง', 'expense', '#0284C7', TRUE, TRUE),
  (NULL, 'ค่าอุปกรณ์', 'expense', '#4F46E5', TRUE, TRUE),
  (NULL, 'ค่าเช่า', 'expense', '#BE123C', TRUE, TRUE),
  (NULL, 'ค่าใช้จ่ายอื่นๆ', 'expense', '#64748B', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- 2. SEED CREDIT PACKAGES (FREE, STARTER, BUSINESS)
INSERT INTO public.credit_packages (code, name, description, credits, price_thb, features, is_active, sort_order)
VALUES
  (
    'FREE',
    'ทดลองใช้งานฟรี (Free Trial)',
    'เริ่มต้นลองสแกนสลิปและใบเสร็จด้วย AI ฟรี 5 รูปแรก',
    5,
    0.00,
    ARRAY['สแกนสลิปและใบเสร็จ 5 รูป', 'ตรวจจับสลิปซ้ำ 2 ระดับอัตโนมัติ', 'Export Excel (.xlsx 5 ชีต) และ CSV'],
    TRUE,
    1
  ),
  (
    'STARTER',
    'แพ็กเกจเริ่มต้น (Starter)',
    'เหมาะสำหรับฟรีแลนซ์และร้านค้าขนาดเล็ก เคลียร์บิลรายเดือนสบายๆ',
    100,
    59.00,
    ARRAY['100 เครดิต (เฉลี่ยรูปละ 0.59 บาท)', 'แยกรายรับ-รายจ่ายและถอด VAT อัตโนมัติ', 'รูปซ้ำหรืออ่านไม่สำเร็จ ไม่หักเครดิต', 'เครดิตไม่มีวันหมดอายุ'],
    TRUE,
    2
  ),
  (
    'BUSINESS',
    'แพ็กเกจร้านค้าขายดี (Business)',
    'คุ้มค่าที่สุดสำหรับร้านค้าออนไลน์ที่มีสลิปและใบกำกับภาษีจำนวนมาก',
    500,
    199.00,
    ARRAY['500 เครดิต (ประหยัดคุ้มสุด รูปละ 0.39 บาท)', 'อัปโหลดพร้อมกันสูงสุด 100 รูปต่อรอบ', 'จัดหมวดหมู่ค่าใช้จ่าย AI อัจฉริยะ', 'รายงานภาษีซื้อ-ภาษีขายและงบกำไรสุทธิครบชุด'],
    TRUE,
    3
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  credits = EXCLUDED.credits,
  price_thb = EXCLUDED.price_thb,
  features = EXCLUDED.features;

-- 3. SUPABASE PRIVATE STORAGE BUCKET SETUP (documents-private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents-private',
  'documents-private',
  FALSE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can only upload/read/delete files inside their own folder `<user_id>/*`
CREATE POLICY "storage_documents_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents-private' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents-private' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_documents_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents-private' AND (storage.foldername(name))[1] = auth.uid()::text);
