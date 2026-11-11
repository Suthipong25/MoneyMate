# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Thai online merchants, SME shop owners, freelancers, and bookkeepers who receive dozens to hundreds of Thai bank transfer slips (KBANK, SCB, BBL, KTB), purchase receipts, and 7% VAT tax invoices every month, plus Super Admins operating platform support and credit/payment governance.

## Product Purpose
MoneyMate (เพื่อนช่วยจัดการเงิน) turns batches of up to 100 slip and receipt images into a verified income/expense ledger, 7% VAT summary, and 5-sheet `.xlsx` Excel workbook (`Summary`, `Income`, `Expense`, `Transactions`, `Categories`) without manual data entry.

## Positioning
Context-aware direction classification that compares extracted sender/receiver names and account numbers against the shop's registered business profile (`income`, `expense`, `internal_transfer`, `needs_review`), combined with 2-tier duplicate detection (Tier 1 SHA-256 binary hash and Tier 2 Reference ID + amount/date/time matching) where duplicate or failed items never deduct user credits.

## Operating Context
Used at a shop desk or laptop alongside Thai banking apps, LINE chat slip folders, and Microsoft Excel. Supports anonymous 5-image live trial on the landing page, pay-per-use PromptPay QR top-ups (FREE 5 credits, STARTER 59 THB / 100 credits, BUSINESS 199 THB / 500 credits), and a separate MFA-protected `/admin` portal with mandatory audit-log reasons.

## Capabilities and Constraints
- Multi-role portals: Public (`/`), Customer (`/app/*`), and Super Admin (`/admin/*`).
- Dashboard net formula (`Net Amount = Total Income - Total Expense`) strictly includes only `confirmed` income/expense items and excludes `duplicate`, `failed`, `pending_review`, and `internal_transfer`.
- Mandatory Thai accounting/tax disclaimer on financial summaries.

## Brand Commitments
- Name: MoneyMate (เพื่อนช่วยจัดการเงิน) — friendly, approachable, easy to use.
- Pinned visual direction from user: cute, rounded, friendly Thai/Latin typography (`Mitr`, `Mali`, `Anuphan`) and a strict 4-color core palette of Sky Blue (ฟ้า), Deep Navy/Royal Blue (น้ำเงิน), Pure White (ขาว), and Crimson Red (แดง), with zero generic AI-slop patterns.

## Evidence on Hand
- Working extraction schema, 5-sample live demo dataset (`DEMO_SLIP_SAMPLES`), interactive ROI slider, embedded 7% VAT calculator, and real 5-sheet ExcelJS `.xlsx` & UTF-8 BOM `.csv` export endpoints.
- No fabricated customer testimonials or unverified third-party logos.

## Product Principles
1. Show the slip-to-Excel mechanism working immediately in the first viewport rather than describing it with marketing filler.
2. Never charge credits for duplicate slips or failed AI reads.
3. Keep financial numbers scannable (`tabular-nums`) and separate unverified items (`pending_review`) from confirmed totals.
4. Require explicit human accountability (`audit_logs` with mandatory reason) for every administrative override.

## Accessibility & Inclusion
WCAG 2.2 AA contrast ratios, visible `:focus-visible` outlines, keyboard operability, accessible labels on all controls, responsive layout down to 320px width and 200% zoom, and `prefers-reduced-motion` support.
