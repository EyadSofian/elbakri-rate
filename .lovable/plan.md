## Mobile UX/UI Pass — ELBAKRI Hotel Rates

A focused, end-to-end mobile polish across all main pages. RTL-first, no horizontal overflow, 44px touch targets, cards instead of tables, sticky primary actions, bottom sheets for filters/selections, and a clean export surface for sharing.

### 1. Shell & navigation
- `AppShell.tsx`: add a mobile **bottom navigation bar** (الرئيسية / الفنادق / الباكدجات / العروض / المزيد) using lucide icons, role-filtered. Keep existing top bar with hamburger drawer for "More" (Users, Groups, Quotes, sign-out, language).
- Pad main content with `pb-20` on mobile so the bottom nav never overlaps content; keep desktop sidebar untouched (`hidden lg:flex`).
- Hide bottom nav on `print:` and on the client export route.

### 2. Reusable mobile primitives
- `src/components/mobile/BottomSheet.tsx` — thin wrapper over shadcn `Sheet side="bottom"` with rounded top, drag handle, max-h, scroll body, sticky footer.
- `src/components/mobile/FilterSheet.tsx` — generic filter bottom sheet trigger button + apply/clear footer.
- `src/components/mobile/StickyActionBar.tsx` — fixed bottom bar above the bottom nav for page-level primary actions (e.g. "إنشاء عرض للعميل").
- `src/components/mobile/RateCard.tsx` — compact card showing hotel, package, date range, room/meal, price, status badge, overflow action menu. Reused across Dashboard, Hotel detail, Package detail, Sales.

### 3. Page-by-page changes

**Auth** (`routes/auth.tsx`): center card with max-w-sm, larger inputs (h-12), larger logo, no horizontal padding crush on 360px.

**Dashboard** (`_authenticated/dashboard.tsx`):
- KPI row → horizontal scroll snap on mobile, 4-up on desktop.
- Action buttons stack to a 2-col grid on mobile; primary action ("إضافة سعر") becomes a floating FAB on mobile.
- Filters collapse into "فلترة" trigger → `FilterSheet`. Active filter chips shown below.
- Rate list: cards (RateCard) on mobile, table on `lg:`. Add "عرض جدول" toggle on tablet/desktop only.

**Hotels list** (`_authenticated/hotels.tsx`): filter bar → `FilterSheet` on mobile; cards already responsive — tighten paddings, ensure action row wraps cleanly with 44px targets.

**Hotel detail** (`_authenticated/hotels.$id.tsx`): tabs become a horizontally scrollable segmented control on mobile; rates tab uses `RateCard`; "إضافة فترات متعددة" becomes sticky bottom button.

**Packages list & detail** (`_authenticated/packages.tsx`, `packages.$id.tsx`):
- Detail header stacks; status + counts as chips.
- Per-hotel rate groups collapse via `Collapsible` on mobile; selection checkboxes 44px.
- `PackageBulkActions` bar becomes a bottom sheet trigger on mobile with action grid.

**Sales package view** (`_authenticated/sales.packages.$id.tsx`) — biggest mobile win:
- Sticky compact header with package title + filter button + mode toggle.
- Hotel cards stacked, price chips for Double/Triple/Single, big "إضافة للعرض" CTA.
- Selected count sticky at bottom; tapping opens "العروض المختارة" bottom sheet with remove/edit-note and PDF/PNG/WhatsApp/إنشاء عرض actions.

**Sales** (`_authenticated/sales.tsx`): tabs full-width on mobile, filters → bottom sheet, results as cards.

**Quote builder** (`_authenticated/quotes.new.tsx`, `quotes.tsx`): stacked cards per item, swipe-friendly remove, sticky bottom action bar with PDF/PNG/WhatsApp/حفظ.

**Client preview/export** (`_authenticated/quotes.$id.tsx`): export area fixed at WhatsApp-friendly width (e.g. 720px) and centered; on-screen admin chrome hidden in export DOM; "show details" `Collapsible` for long policies in normal view; export contains summarized version. No bottom nav on this route.

**Users & access** (`_authenticated/users.tsx`, `hotel-groups.tsx`): table → stacked cards on mobile with role/active toggle and "صلاحيات" button per row.

**Forms** (`RateFormDialog`, `HotelFormDialog`, `HotelRatePeriodsDialog`, `PackageFormDialog`, `RateMatrix`):
- Dialog content uses `max-h-[92vh]` with scroll body and sticky footer holding primary save.
- Group fields into clear sections (البيانات الأساسية / التسعير / السياسات / المراجعة) using `Collapsible` accordions on mobile, all-expanded on desktop.
- Numeric price fields: `inputMode="decimal"`, `type="number"`. Date fields: native `type="date"` for reliable mobile pickers.
- Validation messages render directly under each field.
- Inputs h-11 on mobile.

### 4. Global styles (`src/styles.css`)
- Add safe-area padding utility for iOS, base `min-h-11` on inputs/buttons via utility classes used in forms, `.no-scrollbar` helper, `overflow-x: hidden` on `html, body` to kill horizontal scroll.
- Keep palette/tokens unchanged (already navy + gold). Add `--surface-muted` for light blue-gray page bg if not present and ensure cards use `rounded-lg` (8px) max.

### 5. Validation
- Manual viewport checks at 360 / 390 / 430 / 768 / 1024 via Playwright screenshots of dashboard, sales package, quote export.
- Verify no `overflow-x` on `<body>` at 360.
- Verify bottom nav doesn't overlap last row (test scrolling to bottom).
- Confirm desktop (`lg:`) layouts unchanged via screenshot diff at 1280.

### Out of scope
- No data-model changes, no RLS changes, no new routes, no backend logic changes. Pure presentation/responsive work.

### Technical notes
Files touched (approx): `AppShell.tsx`, `styles.css`, new `components/mobile/*`, `RateFormDialog.tsx`, `HotelFormDialog.tsx`, `HotelRatePeriodsDialog.tsx`, `PackageFormDialog.tsx`, `PackageBulkActions.tsx`, `RateMatrix.tsx`, and the 12 listed route files. No changes to `lib/quoteService.ts`, Supabase migrations, `integrations/supabase/*`, or sheets sync.
