import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'ar' | 'en'
export type Dir = 'rtl' | 'ltr'

const STORAGE_KEY = 'elbakri_lang'

const AR: Record<string, string> = {
  'brand.name': 'ELBAKRI OVERSEAS',
  'brand.tagline': 'للسياحة والسفر',
  'brand.taglineEn': 'FOR TRAVEL',

  'common.close': 'إغلاق',
  'common.menu': 'القائمة',
  'common.more': 'المزيد',
  'common.logout': 'خروج',
  'common.none': '—',

  'lang.toggle': 'EN',
  'lang.label': 'اللغة',

  'nav.dashboard': 'لوحة التحكم',
  'nav.hotels': 'الفنادق',
  'nav.groups': 'المجموعات',
  'nav.packages': 'الباقات',
  'nav.matrix': 'مصفوفة الأسعار',
  'nav.sales': 'عروض المبيعات',
  'nav.quotes': 'عروض الأسعار',
  'nav.users': 'المستخدمون',
  'nav.system': 'فحص النظام',
  'nav.settings': 'الإعدادات',
  'quote.continue': 'متابعة عرض السعر',

  'sales.title': 'عروض المبيعات',
  'sales.subtitle': 'الأسعار الجاهزة فقط — أضفها لعرض السعر وصدّرها للعميل',
  'sales.searchPlaceholder': 'ابحث عن فندق أو باقة...',
  'sales.filter': 'فلترة',
  'sales.allRegions': 'كل المناطق',
  'sales.allRooms': 'كل الغرف',
  'sales.allMeals': 'كل الإقامات',
  'sales.maxPrice': 'أقصى سعر',
  'sales.transfersOnly': 'انتقالات مشمولة فقط',
  'sales.tabHotels': 'عروض الفنادق',
  'sales.tabPackages': 'عروض الباكدجات',
  'sales.emptyTitle': 'لا توجد عروض جاهزة',
  'sales.emptyDesc': 'ستظهر هنا الأسعار التي حالتها «جاهز» ضمن نطاق صلاحياتك',
  'sales.readyRate': 'سعر جاهز',
  'sales.proOffer': 'عرض احترافي',

  'offer.add': 'أضف لعرض السعر',
  'offer.added': 'مضاف',
  'offer.addedToast': 'تمت الإضافة إلى عرض السعر',
  'offer.addFail': 'تعذّر الإضافة',

  'export.png': 'تصدير PNG',
  'export.pdf': 'تصدير PDF',
  'export.whatsapp': 'نسخ واتساب',
  'export.pngDone': 'تم تصدير صورة PNG',
  'export.pdfDone': 'تم تصدير PDF',
  'export.pngFail': 'تعذّر تصدير الصورة',
  'export.pdfFail': 'تعذّر تصدير PDF',
  'export.waDone': 'تم نسخ رسالة واتساب',
  'export.waFail': 'تعذّر إنشاء الرسالة',
  'export.noItems': 'لا توجد عناصر للتصدير',
  'export.heading': 'عرض سعر',
  'export.presentedTo': 'مقدم إلى',
  'export.period': 'الفترة',
  'export.meal': 'الإقامة',
  'export.transfers': 'الانتقالات',
  'export.perPerson': 'للفرد',
  'export.children': 'سياسة الأطفال',
  'export.bookingNotes': 'ملاحظات الحجز',
  'export.notes': 'ملاحظات',
  'export.term1': 'الأسعار قابلة للتغيير حسب التوافر',
  'export.term2': 'برجاء التأكيد قبل الحجز · جميع الأسعار بالجنيه المصري عند استخدام EGP',

  'meal.RO': 'بدون وجبات',
  'meal.BB': 'إفطار',
  'meal.HB': 'نصف إقامة',
  'meal.FB': 'إقامة كاملة',
  'meal.AI': 'شامل',
  'meal.SAI': 'سوفت أول إنكلوسيف',
  'meal.UAI': 'شامل فاخر',

  'room.Single': 'فردية',
  'room.Double': 'مزدوجة',
  'room.Triple': 'ثلاثية',
  'room.Quad': 'رباعية',
  'room.Family': 'عائلية',
  'room.Custom': 'مخصصة',

  'pricing.per_person_per_night': 'للفرد / الليلة',
  'pricing.per_room_per_night': 'للغرفة / الليلة',
  'pricing.per_person_package': 'للفرد / الباقة',
  'pricing.per_room_package': 'للغرفة / الباقة',

  'status.Draft': 'مسودة',
  'status.Ready': 'جاهز',
  'status.Archived': 'مؤرشف',
  'quoteStatus.draft': 'مسودة',
  'quoteStatus.ready': 'جاهز',
  'quoteStatus.sent': 'مُرسل',
  'quoteStatus.archived': 'مؤرشف',

  'transfer.Included': 'مشمولة',
  'transfer.Optional': 'اختيارية',
  'transfer.Not Included': 'إخفاء من العرض',

  'role.admin': 'مدير',
  'role.operations': 'عمليات',
  'role.sales': 'مبيعات',
  'role.viewer': 'قارئ',

  'category.Hotel': 'فندق',
  'category.Package': 'باقة',
  'category.Select': 'سيليكت',
  'category.Premium': 'بريميوم',
  'category.Elite': 'إيليت',
  'category.Honeymoon': 'شهر عسل',
  'category.Trip': 'رحلة',
  'category.Transfer': 'انتقالات',
  'category.default.package': 'باقة',
}

const EN: Record<string, string> = {
  'brand.name': 'ELBAKRI OVERSEAS',
  'brand.tagline': 'FOR TRAVEL',
  'brand.taglineEn': 'FOR TRAVEL',

  'common.close': 'Close',
  'common.menu': 'Menu',
  'common.more': 'More',
  'common.logout': 'Sign out',
  'common.none': '—',

  'lang.toggle': 'AR',
  'lang.label': 'Language',

  'nav.dashboard': 'Dashboard',
  'nav.hotels': 'Hotels',
  'nav.groups': 'Hotel Groups',
  'nav.packages': 'Packages',
  'nav.matrix': 'Rate Matrix',
  'nav.sales': 'Sales Offers',
  'nav.quotes': 'Quotes',
  'nav.users': 'Users',
  'nav.system': 'System Check',
  'nav.settings': 'Settings',
  'quote.continue': 'Continue quote',

  'sales.title': 'Sales Offers',
  'sales.subtitle': 'Ready rates only — add them to a quote and export for the client',
  'sales.searchPlaceholder': 'Search for a hotel or package...',
  'sales.filter': 'Filter',
  'sales.allRegions': 'All regions',
  'sales.allRooms': 'All rooms',
  'sales.allMeals': 'All meal plans',
  'sales.maxPrice': 'Max price',
  'sales.transfersOnly': 'Transfers included only',
  'sales.tabHotels': 'Hotel offers',
  'sales.tabPackages': 'Package offers',
  'sales.emptyTitle': 'No ready offers',
  'sales.emptyDesc': 'Rates marked Ready within your access scope will appear here',
  'sales.readyRate': 'ready rate',
  'sales.proOffer': 'Professional offer',

  'offer.add': 'Add to quote',
  'offer.added': 'Added',
  'offer.addedToast': 'Added to quote',
  'offer.addFail': 'Could not add',

  'export.png': 'Export PNG',
  'export.pdf': 'Export PDF',
  'export.whatsapp': 'Copy WhatsApp',
  'export.pngDone': 'PNG image exported',
  'export.pdfDone': 'PDF exported',
  'export.pngFail': 'Could not export image',
  'export.pdfFail': 'Could not export PDF',
  'export.waDone': 'WhatsApp message copied',
  'export.waFail': 'Could not build the message',
  'export.noItems': 'No items to export',
  'export.heading': 'Price Offer',
  'export.presentedTo': 'Presented to',
  'export.period': 'Period',
  'export.meal': 'Meal plan',
  'export.transfers': 'Transfers',
  'export.perPerson': 'per person',
  'export.children': 'Child policy',
  'export.bookingNotes': 'Booking notes',
  'export.notes': 'Notes',
  'export.term1': 'Prices are subject to availability',
  'export.term2': 'Please confirm before booking · All prices are in Egyptian pounds when using EGP',

  'meal.RO': 'Room Only',
  'meal.BB': 'Bed & Breakfast',
  'meal.HB': 'Half Board',
  'meal.FB': 'Full Board',
  'meal.AI': 'All Inclusive',
  'meal.SAI': 'Soft All Inclusive',
  'meal.UAI': 'Ultra All Inclusive',

  'room.Single': 'Single',
  'room.Double': 'Double',
  'room.Triple': 'Triple',
  'room.Quad': 'Quad',
  'room.Family': 'Family',
  'room.Custom': 'Custom',

  'pricing.per_person_per_night': 'per person / night',
  'pricing.per_room_per_night': 'per room / night',
  'pricing.per_person_package': 'per person / package',
  'pricing.per_room_package': 'per room / package',

  'status.Draft': 'Draft',
  'status.Ready': 'Ready',
  'status.Archived': 'Archived',
  'quoteStatus.draft': 'Draft',
  'quoteStatus.ready': 'Ready',
  'quoteStatus.sent': 'Sent',
  'quoteStatus.archived': 'Archived',

  'transfer.Included': 'Included',
  'transfer.Optional': 'Optional',
  'transfer.Not Included': 'Hide from offer',

  'role.admin': 'Admin',
  'role.operations': 'Operations',
  'role.sales': 'Sales',
  'role.viewer': 'Viewer',

  'category.Hotel': 'Hotel',
  'category.Package': 'Package',
  'category.Select': 'Select',
  'category.Premium': 'Premium',
  'category.Elite': 'Elite',
  'category.Honeymoon': 'Honeymoon',
  'category.Trip': 'Trip',
  'category.Transfer': 'Transfer',
  'category.default.package': 'Package',
}

const DICTS: Record<Lang, Record<string, string>> = { ar: AR, en: EN }

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>) {
  let out = DICTS[lang][key] ?? AR[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
  }
  return out
}

export function dirFor(lang: Lang): Dir {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'ar'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'en' || stored === 'ar' ? stored : 'ar'
}

interface I18nValue {
  lang: Lang
  dir: Dir
  setLang: (lang: Lang) => void
  toggle: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    const dir = dirFor(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore storage failures */
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggle = useCallback(() => setLangState((current) => (current === 'ar' ? 'en' : 'ar')), [])
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
  const value = useMemo<I18nValue>(() => ({ lang, dir: dirFor(lang), setLang, toggle, t }), [lang, setLang, toggle, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
