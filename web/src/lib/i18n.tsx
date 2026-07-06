import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'ar' | 'en'
export type Dir = 'rtl' | 'ltr'

const STORAGE_KEY = 'elbakri_lang'

/* ------------------------------------------------------------------ *
 * Dictionaries
 * Keys are namespaced with dots. Enum labels (meal/room/transfer/…) live
 * here too so every label in the app — UI chrome and data enums alike —
 * comes from a single translation source.
 * ------------------------------------------------------------------ */
const AR: Record<string, string> = {
  // Brand
  'brand.name': 'ELBAKRI OVERSEAS',
  'brand.tagline': 'للسياحة والسفر',
  'brand.taglineEn': 'FOR TRAVEL',
  'brand.est': 'EST. 1982',

  // Generic actions / states
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.delete': 'حذف',
  'common.edit': 'تعديل',
  'common.add': 'إضافة',
  'common.close': 'إغلاق',
  'common.search': 'بحث',
  'common.loading': 'جارٍ التحميل…',
  'common.optional': 'اختياري',
  'common.all': 'الكل',
  'common.selectAll': 'تحديد الكل',
  'common.menu': 'القائمة',
  'common.more': 'المزيد',
  'common.logout': 'خروج',
  'common.notFound': 'غير موجود',
  'common.error': 'حدث خطأ.',
  'common.none': '—',
  'common.preview': 'معاينة',

  // Language toggle
  'lang.toggle': 'English',
  'lang.label': 'اللغة',

  // Navigation
  'nav.dashboard': 'لوحة التحكم',
  'nav.hotels': 'الفنادق',
  'nav.groups': 'مجموعات الفنادق',
  'nav.packages': 'الباقات',
  'nav.honeymoon': 'الهاني مون',
  'nav.sales': 'عروض المبيعات',
  'nav.quotes': 'عروض الأسعار',
  'nav.users': 'المستخدمون',
  'nav.system': 'فحص النظام',
  'nav.settings': 'الإعدادات',

  // Quotes
  'quote.continue': 'متابعة عرض السعر',

  // Auth
  'auth.title': 'تسجيل الدخول',
  'auth.subtitle': 'أدخل بياناتك للوصول إلى لوحة التحكم',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.signin': 'دخول',
  'auth.heroTitle': 'نظام إدارة أسعار الفنادق والباقات',
  'auth.heroBody': 'منصة ELBAKRI OVERSEAS لإدارة أسعار الفنادق والباقات وإنشاء عروض أسعار احترافية للعملاء بضغطة زر.',
  'auth.demoTitle': 'حسابات تجريبية (اضغط للتعبئة)',
  'auth.success': 'تم تسجيل الدخول بنجاح',
  'auth.fail': 'تعذّر تسجيل الدخول',
  'auth.badEmail': 'بريد إلكتروني غير صحيح',
  'auth.needPassword': 'أدخل كلمة المرور',

  // Sales
  'sales.title': 'عروض المبيعات',
  'sales.subtitle': 'الأسعار الجاهزة فقط — أضفها لعرض السعر وصدّرها للعميل',
  'sales.searchPlaceholder': 'ابحث عن فندق أو باقة…',
  'sales.filter': 'فلترة',
  'sales.allRegions': 'كل المناطق',
  'sales.allRooms': 'كل الغرف',
  'sales.allMeals': 'كل الإقامات',
  'sales.maxPrice': 'أقصى سعر',
  'sales.transfersOnly': 'انتقالات مشمولة فقط',
  'sales.tabHotels': 'عروض الفنادق',
  'sales.tabPackages': 'عروض الباقات',
  'sales.emptyTitle': 'لا توجد عروض جاهزة',
  'sales.emptyDesc': 'ستظهر هنا الأسعار التي حالتها «جاهز» ضمن نطاق صلاحياتك',
  'sales.readyRate': 'سعر جاهز',
  'sales.proOffer': 'عرض احترافي',
  'sales.clientName': 'اسم العميل (اختياري)',
  'sales.previewClient': 'معاينة العميل',
  'sales.endPreview': 'إنهاء المعاينة',
  'sales.exportAllHint': 'سيتم تصدير كل الأسعار. حدد أسعارًا معينة لتخصيص العرض.',
  'sales.selectedHint': 'محدد {n} سعر للتصدير.',
  'sales.noReadyInPackage': 'لا توجد أسعار جاهزة في هذه الباقة',
  'sales.readyOffers': 'عرض جاهز',

  // Offer card
  'offer.add': 'أضف لعرض السعر',
  'offer.added': 'مضاف',
  'offer.addedToast': 'تمت الإضافة إلى عرض السعر',
  'offer.addFail': 'تعذّر الإضافة',

  // Export
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
  'export.pngDoneMulti': 'تم تصدير {n} صور PNG مرقمة',
  'export.heading': 'عرض سعر',
  'export.presentedTo': 'مقدم إلى',
  'export.perPerson': 'للفرد',
  'export.period': 'الفترة',
  'export.allPeriods': 'كل الفترات',
  'export.transfers': 'الانتقالات',
  'export.children': 'سياسة الأطفال',
  'export.notes': 'ملاحظات',
  'export.term1': 'الأسعار قابلة للتغيير حسب التوافر.',
  'export.term2': 'برجاء التأكيد قبل الحجز.',
  'export.issued': 'صدر بتاريخ',
  'export.page': 'صفحة',
  'export.meal': 'الوجبة',
  'export.reference': 'رقم العرض',
  'export.pricingBasis': 'نوع التسعير',
  'export.hotelsCount': 'عدد الفنادق: {n}',
  'export.allPricesIn': 'جميع الأسعار ب{cur}',
  'export.basisPerPerson': 'الأسعار للفرد',
  'export.basisPerRoom': 'الأسعار للغرفة',
  'honeymoon.badge': 'عرض هاني مون',
  'honeymoon.priceType': 'نوع السعر',
  'honeymoon.price': 'السعر',
  'honeymoon.notes': 'ملاحظات',
  'honeymoon.features': 'المميزات والتفاصيل',
  'currency.EGP': 'الجنيه المصري',
  'currency.USD': 'الدولار الأمريكي',
  'currency.EUR': 'اليورو',
  'currency.SAR': 'الريال السعودي',

  // Package export panel
  'pkg.exportTitle': 'تصدير الباقة للعميل',
  'pkg.exportHint': 'بدون تحديد سيتم تصدير الأسعار الجاهزة فقط. عند تحديد أسعار من القائمة سيتم تصدير المحدد فقط.',
  'pkg.readyToExport': 'جاهز للتصدير',
  'pkg.willExport': 'سيصدر الآن',

  // Enum: meal plans
  'meal.RO': 'بدون وجبات',
  'meal.BB': 'إفطار',
  'meal.HB': 'نصف إقامة',
  'meal.FB': 'إقامة كاملة',
  'meal.AI': 'شامل',
  'meal.SAI': 'سوفت أول إنكلوسف',
  'meal.UAI': 'شامل فاخر',

  // Enum: room types
  'room.Single': 'فردية',
  'room.Double': 'مزدوجة',
  'room.Triple': 'ثلاثية',
  'room.Quad': 'رباعية',
  'room.Family': 'عائلية',
  'room.Custom': 'مخصصة',

  // Enum: pricing basis
  'pricing.per_person_per_night': 'للفرد / الليلة',
  'pricing.per_room_per_night': 'للغرفة / الليلة',
  'pricing.per_person_package': 'للفرد / الباقة',
  'pricing.per_room_package': 'للغرفة / الباقة',

  // Enum: rate status
  'status.Draft': 'مسودة',
  'status.Ready': 'جاهز',
  'status.Archived': 'مؤرشف',

  // Enum: quote status
  'quoteStatus.draft': 'مسودة',
  'quoteStatus.ready': 'جاهز',
  'quoteStatus.sent': 'مُرسل',
  'quoteStatus.archived': 'مؤرشف',

  // Enum: transfer
  'transfer.Included': 'مشمولة',
  'transfer.Optional': 'اختيارية',
  'transfer.Not Included': 'غير مشمولة',

  // Enum: role
  'role.admin': 'مدير',
  'role.operations': 'عمليات',
  'role.sales': 'مبيعات',
  'role.viewer': 'قارئ',

  // Enum: category / package type fallback
  'category.Hotel': 'فندق',
  'category.Package': 'باقة',
  'category.Select': 'سيليكت',
  'category.Premium': 'بريميوم',
  'category.Elite': 'إيليت',
  'category.Honeymoon': 'شهر عسل',
  'category.Trip': 'رحلة',
  'category.Transfer': 'انتقالات',
  'category.default.package': 'باقة',
  'category.default.hotel': 'فندق',

  // Common (extra)
  'common.active': 'نشط',
  'common.inactive': 'غير نشط',
  'common.confirm': 'تأكيد',
  'common.export': 'تصدير',
  'common.import': 'استيراد',
  'common.print': 'طباعة',
  'common.select': '— اختر —',
  'common.noneOption': '— بدون —',
  'common.dash': '—',

  // Generic toasts / errors
  'err.save': 'تعذّر الحفظ',
  'err.delete': 'تعذّر الحذف',
  'err.update': 'تعذّر التحديث',
  'err.copy': 'تعذّر النسخ',
  'err.export': 'تعذّر التصدير',
  'err.notFound': 'غير موجود',

  // Bulk actions
  'bulk.markPeriodReady': 'اجعل الفترة جاهزة',
  'bulk.periodReadyDone': 'تم تجهيز {n} سعر في الفترة',

  // Confirm dialog
  'confirm.title': 'تأكيد',

  // Filters (shared)
  'filter.allGroups': 'كل المجموعات',
  'filter.allStatuses': 'كل الحالات',

  // Export (extra)
  'export.offerTitleHotel': 'عرض سعر {name}',
  'export.perRoom': 'للغرفة',
  'export.hotelInfo': 'معلومات الفندق',
  'export.facilities': 'المرافق',
  'export.copy': 'نسخ واتساب',

  // Hotels list
  'hotels.subtitle': 'إدارة الفنادق المستقلة وأسعارها',
  'hotels.add': 'إضافة فندق',
  'hotels.searchPlaceholder': 'ابحث عن فندق...',
  'hotels.emptyTitle': 'لا توجد فنادق',
  'hotels.emptyDesc': 'ابدأ بإضافة أول فندق ومعه فترات الأسعار',
  'hotels.ratesLabel': 'الأسعار',
  'hotels.readyLabel': 'جاهز',
  'hotels.quickExport': 'تصدير سريع',
  'hotels.loadingExport': 'جارٍ تجهيز التصدير…',

  // Hotel detail
  'hotel.periods': 'فترات أسعار',
  'hotel.addRate': 'إضافة سعر',
  'hotel.tabIndependent': 'أسعار مستقلة',
  'hotel.tabPackage': 'أسعار داخل باقات',
  'hotel.tabPackages': 'الباقات المرتبطة',
  'hotel.noPackages': 'غير مرتبط بأي باقة',
  'hotel.noRates': 'لا توجد أسعار',
  'hotel.noRatesDesc': 'أضف سعرًا أو فترات أسعار',
  'hotel.addPeriodsTitle': 'إضافة فترات أسعار',
  'hotel.periodsSection': 'الفترات',
  'hotel.savePeriods': 'حفظ ({n} سعر)',
  'hotel.deleteRateQ': 'هل تريد حذف هذا السعر؟',
  'hotel.exportTitle': 'تصدير أسعار الفندق',
  'hotel.exportHint': 'يصدّر كل أسعار الفندق مجمّعة حسب الفترة ونوع الغرفة.',
  'hotel.ratesAdded': 'تمت إضافة {n} سعر',
  'hotel.rateDeleted': 'تم حذف السعر',
  'hotel.deleteQ': 'هل تريد حذف الفندق {name}؟',
  'hotel.deleted': 'تم حذف الفندق',

  // Quotes list
  'quotes.subtitle': 'عروض الأسعار المحفوظة والمرسلة',
  'quotes.new': 'عرض جديد',
  'quotes.empty': 'لا توجد عروض',
  'quotes.noName': 'بدون اسم',
  'quotes.items': 'عنصر',

  // Quote detail
  'quote.statusUpdated': 'تم تحديث الحالة',
  'quote.linkCopied': 'تم نسخ رابط العرض',
  'quote.copyLink': 'نسخ الرابط',
  'quote.markSent': 'تعليم كمُرسل',
  'quote.titlePrefix': 'عرض سعر',

  // New quote
  'quoteNew.title': 'عرض سعر جديد',
  'quoteNew.empty': 'لا توجد عناصر في العرض',
  'quoteNew.emptyDesc': 'اذهب لصفحة عروض المبيعات وأضف أسعارًا إلى العرض',
  'quoteNew.browse': 'تصفح العروض',
  'quoteNew.clientData': 'بيانات العميل',
  'quoteNew.clientName': 'اسم العميل',
  'quoteNew.clientNamePlaceholder': 'مثال: أحمد محمد',
  'quoteNew.phone': 'رقم الهاتف',
  'quoteNew.notes': 'ملاحظات',
  'quoteNew.saveReady': 'حفظ كجاهز',
  'quoteNew.saveDraft': 'حفظ كمسودة',
  'quoteNew.savedReady': 'تم حفظ العرض كجاهز',
  'quoteNew.savedDraft': 'تم حفظ المسودة',

  // Packages list
  'packages.subtitle': 'باقات الفنادق وشهر العسل والعروض',
  'packages.add': 'إضافة باقة',
  'packages.empty': 'لا توجد باقات',
  'packages.hotelsCount': 'فندق',
  'packages.readyCount': 'سعر جاهز',

  // Package detail
  'package.salesView': 'عرض المبيعات',
  'package.manageHotels': 'إدارة فنادق الباقة',
  'package.noHotels': 'لا توجد فنادق مرتبطة — عدّل الباقة لإضافتها',
  'package.noHotelsTitle': 'أضف فنادق للباقة',
  'package.ratesByHotel': 'الأسعار حسب الفندق',
  'package.ratesCount': 'سعر',
  'package.noRatesInPackage': 'لا توجد أسعار لفنادق هذه الباقة',
  'package.noRatesDesc': 'أضف الأسعار من صفحة الفندق، ثم ستظهر هنا تلقائيًا حسب الفنادق المرتبطة بالباقة.',
  'package.copyToHotels': 'نسخ لفنادق',
  'package.archive': 'أرشفة',
  'package.markReady': 'جاهز',
  'package.selected': 'محدد',
  'package.copyTitle': 'نسخ الأسعار إلى فنادق',
  'package.copyDesc': 'سيتم نسخ {n} سعر إلى الفنادق المختارة.',
  'package.copyBtn': 'نسخ ({a} × {b})',
  'package.selectHotelErr': 'اختر فندقًا',
  'package.statusUpdated': 'تم تحديث {n} سعر',
  'package.copied': 'تم نسخ {n} سعر',
  'package.deleteQ': 'هل تريد حذف الباقة {name}؟',
  'package.deleted': 'تم حذف الباقة',

  // Package form
  'pkgForm.editTitle': 'تعديل باقة',
  'pkgForm.addTitle': 'إضافة باقة',
  'pkgForm.name': 'اسم الباقة',
  'pkgForm.namePlaceholder': 'مثال: مجموعة الباتروس شرم الشيخ',
  'pkgForm.type': 'النوع',
  'pkgForm.region': 'المنطقة',
  'pkgForm.multi': 'متعدد',
  'pkgForm.group': 'المجموعة',
  'pkgForm.description': 'الوصف',
  'pkgForm.hotels': 'الفنادق المشمولة',
  'pkgForm.searchHotels': 'بحث...',
  'pkgForm.noHotels': 'لا توجد فنادق',
  'pkgForm.nameRequired': 'اسم الباقة مطلوب',
  'pkgForm.containerNote': 'الباقة عبارة عن حاوية للفنادق فقط. أضف أو احذف الفنادق هنا، أما الأسعار والفترات فتُدار من صفحة الفندق.',

  // Rate form
  'rateForm.editTitle': 'تعديل سعر',
  'rateForm.addTitle': 'إضافة سعر',
  'rateForm.single': 'سعر واحد',
  'rateForm.multi': 'فترات متعددة',
  'rateForm.hotel': 'الفندق',
  'rateForm.selectHotel': '— اختر الفندق —',
  'rateForm.package': 'الباقة (اختياري)',
  'rateForm.independentOption': '— سعر مستقل بدون باقة —',
  'rateForm.periodsTitle': 'الفترات والأسعار',
  'rateForm.periodsHint': 'أضف أكثر من فترة، وكل فترة ممكن يكون لها أسعار مزدوجة/ثلاثية/فردية أو غرفة مخصصة.',
  'rateForm.willCreate': 'سيتم إنشاء {n} سعر',
  'rateForm.roomType': 'نوع الغرفة',
  'rateForm.meal': 'الإقامة',
  'rateForm.dateFrom': 'من تاريخ',
  'rateForm.dateTo': 'إلى تاريخ',
  'rateForm.adultPrice': 'سعر الفرد',
  'rateForm.childPrice': 'سعر الطفل',
  'rateForm.pricingBasis': 'أساس التسعير',
  'rateForm.currency': 'العملة',
  'rateForm.transfer': 'الانتقالات',
  'rateForm.status': 'الحالة',
  'rateForm.childPolicy': 'سياسة الأطفال',
  'rateForm.bookingNotes': 'ملاحظات الحجز',
  'rateForm.selectHotelErr': 'اختر الفندق',
  'rateForm.atLeastOne': 'أدخل سعرًا واحدًا على الأقل داخل الفترات',
  'rateForm.updated': 'تم تحديث السعر',
  'rateForm.added': 'تم إضافة السعر',
  'rateForm.addedN': 'تم إضافة {n} سعر من الفترات',

  // Periods editor
  'period.label': 'الفترة {n}',
  'period.duplicate': 'تكرار',
  'period.delete': 'حذف',
  'period.priceDouble': 'سعر مزدوجة',
  'period.priceTriple': 'سعر ثلاثية',
  'period.priceSingle': 'سعر فردية',
  'period.customRoom': 'غرفة مخصصة',
  'period.customRoomPlaceholder': 'مثال: جناح',
  'period.customPrice': 'سعرها',
  'period.season': 'اسم الموسم (اختياري)',
  'period.seasonPlaceholder': 'مثال: صيف',
  'period.childPolicy': 'سياسة الأطفال للفترة',
  'period.childPolicyPlaceholder': 'مثال: الطفل الأول حتى 11.99 سنة مجانا',
  'period.transferDetails': 'تفاصيل الانتقالات',
  'period.transferDetailsPlaceholder': 'مثال: ذهاب وعودة 600 ج للفرد',
  'period.bookingNotes': 'ملاحظات الحجز',
  'period.bookingNotesPlaceholder': 'أي شروط أو ملاحظات خاصة بالفترة',
  'period.add': 'إضافة فترة',

  // Hotel form
  'hotelForm.editTitle': 'تعديل الفندق',
  'hotelForm.addTitle': 'إضافة فندق',
  'hotelForm.name': 'اسم الفندق',
  'hotelForm.namePlaceholder': 'مثال: Pickalbatros Aqua Park',
  'hotelForm.group': 'المجموعة',
  'hotelForm.noGroup': '— بدون مجموعة —',
  'hotelForm.region': 'المنطقة',
  'hotelForm.subRegion': 'المنطقة الفرعية',
  'hotelForm.subRegionPlaceholder': 'مثال: نبق باي',
  'hotelForm.stars': 'عدد النجوم',
  'hotelForm.starsN': '{n} نجوم',
  'hotelForm.childPolicyDefault': 'سياسة الأطفال الافتراضية',
  'hotelForm.childPolicyPlaceholder': 'مثال: طفل حتى 11.99 سنة مجانًا',
  'hotelForm.transferNotes': 'ملاحظات الانتقالات',
  'hotelForm.addPricingNow': 'إضافة فترات أسعار الآن',
  'hotelForm.addPricingHint': 'أسعار مستقلة للفندق بدون باكدج. يمكن إضافة أكثر من فترة، وكل فترة لها Double / Triple / Single وغرفة مخصصة.',
  'hotelForm.willCreate': 'سيتم إنشاء {n} سعر',
  'hotelForm.nameRequired': 'اسم الفندق مطلوب',
  'hotelForm.updated': 'تم تحديث الفندق',
  'hotelForm.added': 'تم إضافة الفندق',
  'hotelForm.updatedN': 'تم تحديث الفندق وإضافة {n} سعر',
  'hotelForm.addedN': 'تم إضافة الفندق وإضافة {n} سعر',

  // Dashboard
  'dash.title': 'لوحة التحكم',
  'dash.subtitle': 'نظرة عامة على الأسعار والفنادق والباقات',
  'dash.totalRates': 'إجمالي الأسعار',
  'dash.ready': 'جاهزة',
  'dash.draft': 'مسودات',
  'dash.archived': 'مؤرشفة',
  'dash.hotels': 'الفنادق',
  'dash.packages': 'الباقات',
  'dash.addPackage': 'إضافة باكدج',
  'dash.tabIndependent': 'أسعار الفنادق المستقلة',
  'dash.tabPackage': 'أسعار الباقات',
  'dash.tabRecent': 'أحدث التعديلات',
  'dash.emptyTitle': 'لا توجد أسعار بعد',
  'dash.emptyDesc': 'أضف سعرًا أو فندقًا للبدء',
  'dash.exportCsv': 'تصدير CSV',

  // Hotel groups
  'groups.subtitle': 'السلاسل والمجموعات الفندقية',
  'groups.add': 'إضافة مجموعة',
  'groups.empty': 'لا توجد مجموعات',
  'groups.hotelsCount': 'فندق',
  'groups.packagesCount': 'باقة',
  'groups.editTitle': 'تعديل مجموعة',
  'groups.addTitle': 'إضافة مجموعة',
  'groups.name': 'اسم المجموعة',
  'groups.brand': 'الاسم التجاري',
  'groups.region': 'المنطقة',
  'groups.notes': 'ملاحظات',
  'groups.nameRequired': 'الاسم مطلوب',
  'groups.deleteQ': 'هل تريد حذف مجموعة الفنادق {name}؟',
  'groups.deleted': 'تم حذف مجموعة الفنادق',

  // Settings
  'settings.subtitle': 'معلومات الحساب والنظام',
  'settings.account': 'الحساب',
  'settings.name': 'الاسم',
  'settings.email': 'البريد',
  'settings.role': 'الدور',
  'settings.canEdit': 'صلاحية التعديل',
  'settings.canExport': 'صلاحية التصدير',
  'settings.yes': 'نعم',
  'settings.no': 'لا',
  'settings.logout': 'تسجيل الخروج',
  'settings.about': 'عن النظام',
  'settings.app': 'التطبيق',
  'settings.company': 'الشركة',
  'settings.version': 'الإصدار',
  'settings.database': 'القاعدة',
  'settings.manageUsers': 'إدارة المستخدمين',
  'settings.bilingualNote': 'الواجهة ثنائية اللغة (عربي/إنجليزي) مع دعم RTL وLTR. بدّل اللغة من الأعلى.',

  // Users
  'users.subtitle': 'إدارة المستخدمين والأدوار والصلاحيات',
  'users.add': 'إضافة مستخدم',
  'users.empty': 'لا يوجد مستخدمون',
  'users.suspended': 'موقوف',
  'users.deleteQ': 'حذف المستخدم {name}؟',
  'users.editTitle': 'تعديل مستخدم',
  'users.addTitle': 'إضافة مستخدم',
  'users.fullName': 'الاسم الكامل',
  'users.email': 'البريد الإلكتروني',
  'users.newPassword': 'كلمة مرور جديدة (اختياري)',
  'users.password': 'كلمة المرور',
  'users.passwordHint': '6 أحرف على الأقل',
  'users.active': 'الحساب نشط',
  'users.tabs': 'تاب',
  'users.visibleTabs': 'التابات المسموحة',
  'users.accessRules': 'قواعد الوصول',
  'users.addRule': 'إضافة قاعدة',
  'users.ruleN': 'قاعدة {n}',
  'users.tabsRequired': 'اختر تاب واحد على الأقل',
  'users.allScopeHint': 'وصول لكل البيانات حسب صلاحيات العرض والتعديل والتصدير المختارة',
  'users.scopeNote': 'اختيار التابات يحدد ما يظهر في القائمة الجانبية، وقواعد الوصول تحدد النطاقات المسموح عرضها أو تعديلها أو تصديرها.',
  'users.nameRequired': 'الاسم مطلوب',
  'users.credsRequired': 'البريد وكلمة مرور (6+) مطلوبة',

  // Scopes / permissions
  'scope.all': 'الكل',
  'scope.region': 'منطقة',
  'scope.hotel_group': 'مجموعة فنادق',
  'scope.hotel': 'فندق',
  'scope.package': 'باقة',
  'perm.view': 'عرض',
  'perm.edit': 'تعديل',
  'perm.export': 'تصدير',

  // System check
  'system.subtitle': 'حالة الاتصال وقاعدة البيانات والمكتبات',
  'system.recheck': 'إعادة الفحص',
  'system.ok': 'سليم',
  'system.warn': 'تحذير',
  'system.fail': 'فشل',
  'system.lastCheck': 'آخر فحص',

  // Import
  'import.title': 'استيراد أسعار (CSV / Excel)',
  'import.pick': 'اختر ملف CSV أو Excel',
  'import.expectedCols': 'أعمدة متوقعة: hotel_name، region، room_type، meal_plan، adult_price، date_from، date_to…',
  'import.statusLabel': 'حالة الأسعار المستوردة',
  'import.overwrite': 'استبدال المكرر',
  'import.previewTitle': 'معاينة ({n} صف) — أول 5',
  'import.btn': 'استيراد',
  'import.done': 'تم الاستيراد بنجاح',
  'import.succeeded': 'نجح',
  'import.failed': 'فشل',
  'import.noRows': 'لم يتم العثور على صفوف صالحة (تأكد من وجود hotel_name وسعر)',
  'import.importedN': 'تم استيراد {n} سعر',
  'import.failToast': 'تعذّر الاستيراد',
  'common.saved': 'تم الحفظ',
}

const EN: Record<string, string> = {
  'brand.name': 'ELBAKRI OVERSEAS',
  'brand.tagline': 'FOR TRAVEL',
  'brand.taglineEn': 'FOR TRAVEL',
  'brand.est': 'EST. 1982',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.add': 'Add',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.loading': 'Loading…',
  'common.optional': 'optional',
  'common.all': 'All',
  'common.selectAll': 'Select all',
  'common.menu': 'Menu',
  'common.more': 'More',
  'common.logout': 'Sign out',
  'common.notFound': 'Not found',
  'common.error': 'Something went wrong.',
  'common.none': '—',
  'common.preview': 'Preview',

  'lang.toggle': 'العربية',
  'lang.label': 'Language',

  'nav.dashboard': 'Dashboard',
  'nav.hotels': 'Hotels',
  'nav.groups': 'Hotel Groups',
  'nav.packages': 'Packages',
  'nav.honeymoon': 'Honeymoon',
  'nav.sales': 'Sales Offers',
  'nav.quotes': 'Quotes',
  'nav.users': 'Users',
  'nav.system': 'System Check',
  'nav.settings': 'Settings',

  'quote.continue': 'Continue quote',

  'auth.title': 'Sign in',
  'auth.subtitle': 'Enter your credentials to access the dashboard',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signin': 'Sign in',
  'auth.heroTitle': 'Hotel & package rate management',
  'auth.heroBody': 'The ELBAKRI OVERSEAS platform to manage hotel and package rates and generate client-ready quotes in one click.',
  'auth.demoTitle': 'Demo accounts (tap to fill)',
  'auth.success': 'Signed in successfully',
  'auth.fail': 'Sign in failed',
  'auth.badEmail': 'Invalid email address',
  'auth.needPassword': 'Enter your password',

  'sales.title': 'Sales Offers',
  'sales.subtitle': 'Ready rates only — add them to a quote and export for the client',
  'sales.searchPlaceholder': 'Search for a hotel or package…',
  'sales.filter': 'Filter',
  'sales.allRegions': 'All regions',
  'sales.allRooms': 'All rooms',
  'sales.allMeals': 'All meal plans',
  'sales.maxPrice': 'Max price',
  'sales.transfersOnly': 'Transfers included only',
  'sales.tabHotels': 'Hotel offers',
  'sales.tabPackages': 'Package offers',
  'sales.emptyTitle': 'No ready offers',
  'sales.emptyDesc': 'Rates marked “Ready” within your access scope will appear here',
  'sales.readyRate': 'ready rate',
  'sales.proOffer': 'Professional offer',
  'sales.clientName': 'Client name (optional)',
  'sales.previewClient': 'Client preview',
  'sales.endPreview': 'End preview',
  'sales.exportAllHint': 'All rates will be exported. Select specific rates to customize the offer.',
  'sales.selectedHint': '{n} rate(s) selected for export.',
  'sales.noReadyInPackage': 'No ready rates in this package',
  'sales.readyOffers': 'ready offers',

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
  'export.pngDoneMulti': '{n} PNG images exported',
  'export.heading': 'Price Offer',
  'export.presentedTo': 'Presented to',
  'export.perPerson': 'per person',
  'export.period': 'Period',
  'export.allPeriods': 'All periods',
  'export.transfers': 'Transfers',
  'export.children': 'Child policy',
  'export.notes': 'Notes',
  'export.term1': 'Prices are subject to availability.',
  'export.term2': 'Please confirm before booking.',
  'export.issued': 'Issued',
  'export.page': 'Page',
  'export.meal': 'Meal',
  'export.reference': 'Offer no.',
  'export.pricingBasis': 'Pricing basis',
  'export.hotelsCount': '{n} hotels',
  'export.allPricesIn': 'All prices in {cur}',
  'export.basisPerPerson': 'Prices are per person',
  'export.basisPerRoom': 'Prices are per room',
  'honeymoon.badge': 'Honeymoon Offer',
  'honeymoon.priceType': 'Price type',
  'honeymoon.price': 'Price',
  'honeymoon.notes': 'Notes',
  'honeymoon.features': 'Features & Details',
  'currency.EGP': 'EGP',
  'currency.USD': 'USD',
  'currency.EUR': 'EUR',
  'currency.SAR': 'SAR',

  'pkg.exportTitle': 'Export package for client',
  'pkg.exportHint': 'With no selection only ready rates are exported. Selecting rates below exports just those.',
  'pkg.readyToExport': 'Ready to export',
  'pkg.willExport': 'Exporting now',

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
  'transfer.Not Included': 'Not included',

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
  'category.default.hotel': 'Hotel',

  // Common (extra)
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.confirm': 'Confirm',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.print': 'Print',
  'common.select': '— Select —',
  'common.noneOption': '— None —',
  'common.dash': '—',

  // Generic toasts / errors
  'err.save': 'Could not save',
  'err.delete': 'Could not delete',
  'err.update': 'Could not update',
  'err.copy': 'Could not copy',
  'err.export': 'Export failed',
  'err.notFound': 'Not found',

  // Bulk actions
  'bulk.markPeriodReady': 'Mark period ready',
  'bulk.periodReadyDone': '{n} rate(s) marked ready',

  // Confirm dialog
  'confirm.title': 'Confirm',

  // Filters (shared)
  'filter.allGroups': 'All groups',
  'filter.allStatuses': 'All statuses',

  // Export (extra)
  'export.offerTitleHotel': '{name} Price Offer',
  'export.perRoom': 'per room',
  'export.hotelInfo': 'Hotel information',
  'export.facilities': 'Facilities',
  'export.copy': 'Copy WhatsApp',

  // Hotels list
  'hotels.subtitle': 'Manage standalone hotels and their rates',
  'hotels.add': 'Add hotel',
  'hotels.searchPlaceholder': 'Search for a hotel…',
  'hotels.emptyTitle': 'No hotels',
  'hotels.emptyDesc': 'Start by adding your first hotel together with its rate periods',
  'hotels.ratesLabel': 'Rates',
  'hotels.readyLabel': 'Ready',
  'hotels.quickExport': 'Quick export',
  'hotels.loadingExport': 'Preparing export…',

  // Hotel detail
  'hotel.periods': 'Rate periods',
  'hotel.addRate': 'Add rate',
  'hotel.tabIndependent': 'Independent rates',
  'hotel.tabPackage': 'Rates within packages',
  'hotel.tabPackages': 'Linked packages',
  'hotel.noPackages': 'Not linked to any package',
  'hotel.noRates': 'No rates',
  'hotel.noRatesDesc': 'Add a rate or rate periods',
  'hotel.addPeriodsTitle': 'Add rate periods',
  'hotel.periodsSection': 'Periods',
  'hotel.savePeriods': 'Save ({n} rates)',
  'hotel.deleteRateQ': 'Delete this rate?',
  'hotel.exportTitle': 'Export hotel rates',
  'hotel.exportHint': 'Exports all of the hotel’s rates grouped by period and room type.',
  'hotel.ratesAdded': '{n} rates added',
  'hotel.rateDeleted': 'Rate deleted',
  'hotel.deleteQ': 'Delete hotel {name}?',
  'hotel.deleted': 'Hotel deleted',

  // Quotes list
  'quotes.subtitle': 'Saved and sent quotes',
  'quotes.new': 'New quote',
  'quotes.empty': 'No quotes',
  'quotes.noName': 'No name',
  'quotes.items': 'item(s)',

  // Quote detail
  'quote.statusUpdated': 'Status updated',
  'quote.linkCopied': 'Quote link copied',
  'quote.copyLink': 'Copy link',
  'quote.markSent': 'Mark as sent',
  'quote.titlePrefix': 'Quote',

  // New quote
  'quoteNew.title': 'New quote',
  'quoteNew.empty': 'No items in the quote',
  'quoteNew.emptyDesc': 'Go to the Sales Offers page and add rates to the quote',
  'quoteNew.browse': 'Browse offers',
  'quoteNew.clientData': 'Client details',
  'quoteNew.clientName': 'Client name',
  'quoteNew.clientNamePlaceholder': 'e.g. Ahmed Mohamed',
  'quoteNew.phone': 'Phone number',
  'quoteNew.notes': 'Notes',
  'quoteNew.saveReady': 'Save as ready',
  'quoteNew.saveDraft': 'Save as draft',
  'quoteNew.savedReady': 'Quote saved as ready',
  'quoteNew.savedDraft': 'Draft saved',

  // Packages list
  'packages.subtitle': 'Hotel, honeymoon and special packages',
  'packages.add': 'Add package',
  'packages.empty': 'No packages',
  'packages.hotelsCount': 'hotel(s)',
  'packages.readyCount': 'ready rate(s)',

  // Package detail
  'package.salesView': 'Sales view',
  'package.manageHotels': 'Manage package hotels',
  'package.noHotels': 'No linked hotels — edit the package to add them',
  'package.noHotelsTitle': 'Add hotels to the package',
  'package.ratesByHotel': 'Rates by hotel',
  'package.ratesCount': 'rate(s)',
  'package.noRatesInPackage': 'No rates for this package hotels',
  'package.noRatesDesc': 'Add rates from the hotel page. They will appear here automatically based on the hotels linked to the package.',
  'package.copyToHotels': 'Copy to hotels',
  'package.archive': 'Archive',
  'package.markReady': 'Ready',
  'package.selected': 'selected',
  'package.copyTitle': 'Copy rates to hotels',
  'package.copyDesc': '{n} rate(s) will be copied to the selected hotels.',
  'package.copyBtn': 'Copy ({a} × {b})',
  'package.selectHotelErr': 'Select a hotel',
  'package.statusUpdated': '{n} rate(s) updated',
  'package.copied': '{n} rate(s) copied',
  'package.deleteQ': 'Delete package {name}?',
  'package.deleted': 'Package deleted',

  // Package form
  'pkgForm.editTitle': 'Edit package',
  'pkgForm.addTitle': 'Add package',
  'pkgForm.name': 'Package name',
  'pkgForm.namePlaceholder': 'e.g. Albatros Sharm El Sheikh collection',
  'pkgForm.type': 'Type',
  'pkgForm.region': 'Region',
  'pkgForm.multi': 'Multiple',
  'pkgForm.group': 'Group',
  'pkgForm.description': 'Description',
  'pkgForm.hotels': 'Included hotels',
  'pkgForm.searchHotels': 'Search…',
  'pkgForm.noHotels': 'No hotels',
  'pkgForm.nameRequired': 'Package name is required',
  'pkgForm.containerNote': 'A package is only a container of hotels. Add or remove hotels here; prices and periods are managed from the hotel page.',

  // Rate form
  'rateForm.editTitle': 'Edit rate',
  'rateForm.addTitle': 'Add rate',
  'rateForm.single': 'Single rate',
  'rateForm.multi': 'Multiple periods',
  'rateForm.hotel': 'Hotel',
  'rateForm.selectHotel': '— Select hotel —',
  'rateForm.package': 'Package (optional)',
  'rateForm.independentOption': '— Standalone rate, no package —',
  'rateForm.periodsTitle': 'Periods & prices',
  'rateForm.periodsHint': 'Add several periods; each period can have Double / Triple / Single prices or a custom room.',
  'rateForm.willCreate': 'Will create {n} rates',
  'rateForm.roomType': 'Room type',
  'rateForm.meal': 'Meal plan',
  'rateForm.dateFrom': 'From date',
  'rateForm.dateTo': 'To date',
  'rateForm.adultPrice': 'Adult price',
  'rateForm.childPrice': 'Child price',
  'rateForm.pricingBasis': 'Pricing basis',
  'rateForm.currency': 'Currency',
  'rateForm.transfer': 'Transfers',
  'rateForm.status': 'Status',
  'rateForm.childPolicy': 'Child policy',
  'rateForm.bookingNotes': 'Booking notes',
  'rateForm.selectHotelErr': 'Select a hotel',
  'rateForm.atLeastOne': 'Enter at least one price inside the periods',
  'rateForm.updated': 'Rate updated',
  'rateForm.added': 'Rate added',
  'rateForm.addedN': '{n} rates added from the periods',

  // Periods editor
  'period.label': 'Period {n}',
  'period.duplicate': 'Duplicate',
  'period.delete': 'Delete',
  'period.priceDouble': 'Double price',
  'period.priceTriple': 'Triple price',
  'period.priceSingle': 'Single price',
  'period.customRoom': 'Custom room',
  'period.customRoomPlaceholder': 'e.g. Suite',
  'period.customPrice': 'Its price',
  'period.season': 'Season name (optional)',
  'period.seasonPlaceholder': 'e.g. Summer',
  'period.childPolicy': 'Child policy (this period)',
  'period.childPolicyPlaceholder': 'e.g. First child free up to 11.99 years',
  'period.transferDetails': 'Transfer details',
  'period.transferDetailsPlaceholder': 'e.g. Round trip 600 EGP per person',
  'period.bookingNotes': 'Booking notes',
  'period.bookingNotesPlaceholder': 'Any terms or notes specific to this period',
  'period.add': 'Add period',

  // Hotel form
  'hotelForm.editTitle': 'Edit hotel',
  'hotelForm.addTitle': 'Add hotel',
  'hotelForm.name': 'Hotel name',
  'hotelForm.namePlaceholder': 'e.g. Pickalbatros Aqua Park',
  'hotelForm.group': 'Group',
  'hotelForm.noGroup': '— No group —',
  'hotelForm.region': 'Region',
  'hotelForm.subRegion': 'Sub-region',
  'hotelForm.subRegionPlaceholder': 'e.g. Nabq Bay',
  'hotelForm.stars': 'Star rating',
  'hotelForm.starsN': '{n} stars',
  'hotelForm.childPolicyDefault': 'Default child policy',
  'hotelForm.childPolicyPlaceholder': 'e.g. Child free up to 11.99 years',
  'hotelForm.transferNotes': 'Transfer notes',
  'hotelForm.addPricingNow': 'Add rate periods now',
  'hotelForm.addPricingHint': 'Standalone hotel rates with no package. Add several periods; each has Double / Triple / Single and a custom room.',
  'hotelForm.willCreate': 'Will create {n} rates',
  'hotelForm.nameRequired': 'Hotel name is required',
  'hotelForm.updated': 'Hotel updated',
  'hotelForm.added': 'Hotel added',
  'hotelForm.updatedN': 'Hotel updated and {n} rates added',
  'hotelForm.addedN': 'Hotel added and {n} rates added',

  // Dashboard
  'dash.title': 'Dashboard',
  'dash.subtitle': 'Overview of rates, hotels and packages',
  'dash.totalRates': 'Total rates',
  'dash.ready': 'Ready',
  'dash.draft': 'Drafts',
  'dash.archived': 'Archived',
  'dash.hotels': 'Hotels',
  'dash.packages': 'Packages',
  'dash.addPackage': 'Add package',
  'dash.tabIndependent': 'Standalone hotel rates',
  'dash.tabPackage': 'Package rates',
  'dash.tabRecent': 'Recently updated',
  'dash.emptyTitle': 'No rates yet',
  'dash.emptyDesc': 'Add a rate or a hotel to get started',
  'dash.exportCsv': 'Export CSV',

  // Hotel groups
  'groups.subtitle': 'Hotel chains and groups',
  'groups.add': 'Add group',
  'groups.empty': 'No groups',
  'groups.hotelsCount': 'hotel(s)',
  'groups.packagesCount': 'package(s)',
  'groups.editTitle': 'Edit group',
  'groups.addTitle': 'Add group',
  'groups.name': 'Group name',
  'groups.brand': 'Brand name',
  'groups.region': 'Region',
  'groups.notes': 'Notes',
  'groups.nameRequired': 'Name is required',
  'groups.deleteQ': 'Delete hotel group {name}?',
  'groups.deleted': 'Hotel group deleted',

  // Settings
  'settings.subtitle': 'Account and system information',
  'settings.account': 'Account',
  'settings.name': 'Name',
  'settings.email': 'Email',
  'settings.role': 'Role',
  'settings.canEdit': 'Edit permission',
  'settings.canExport': 'Export permission',
  'settings.yes': 'Yes',
  'settings.no': 'No',
  'settings.logout': 'Sign out',
  'settings.about': 'About the system',
  'settings.app': 'Application',
  'settings.company': 'Company',
  'settings.version': 'Version',
  'settings.database': 'Database',
  'settings.manageUsers': 'Manage users',
  'settings.bilingualNote': 'The interface is bilingual (Arabic / English) with full RTL and LTR support. Switch the language from the top.',

  // Users
  'users.subtitle': 'Manage users, roles and permissions',
  'users.add': 'Add user',
  'users.empty': 'No users',
  'users.suspended': 'Suspended',
  'users.deleteQ': 'Delete user {name}?',
  'users.editTitle': 'Edit user',
  'users.addTitle': 'Add user',
  'users.fullName': 'Full name',
  'users.email': 'Email',
  'users.newPassword': 'New password (optional)',
  'users.password': 'Password',
  'users.passwordHint': 'At least 6 characters',
  'users.active': 'Account active',
  'users.tabs': 'tab(s)',
  'users.visibleTabs': 'Visible tabs',
  'users.accessRules': 'Access rules',
  'users.addRule': 'Add rule',
  'users.ruleN': 'Rule {n}',
  'users.tabsRequired': 'Select at least one tab',
  'users.allScopeHint': 'Access to all data based on the selected view/edit/export permissions',
  'users.scopeNote': 'Visible tabs control the sidebar pages. Access rules control which data scopes can be viewed, edited, or exported.',
  'users.nameRequired': 'Name is required',
  'users.credsRequired': 'Email and a password (6+) are required',

  // Scopes / permissions
  'scope.all': 'All',
  'scope.region': 'Region',
  'scope.hotel_group': 'Hotel group',
  'scope.hotel': 'Hotel',
  'scope.package': 'Package',
  'perm.view': 'View',
  'perm.edit': 'Edit',
  'perm.export': 'Export',

  // System check
  'system.subtitle': 'Connection, database and library status',
  'system.recheck': 'Re-check',
  'system.ok': 'OK',
  'system.warn': 'Warning',
  'system.fail': 'Fail',
  'system.lastCheck': 'Last check',

  // Import
  'import.title': 'Import rates (CSV / Excel)',
  'import.pick': 'Choose a CSV or Excel file',
  'import.expectedCols': 'Expected columns: hotel_name, region, room_type, meal_plan, adult_price, date_from, date_to…',
  'import.statusLabel': 'Imported rates status',
  'import.overwrite': 'Overwrite duplicates',
  'import.previewTitle': 'Preview ({n} rows) — first 5',
  'import.btn': 'Import',
  'import.done': 'Imported successfully',
  'import.succeeded': 'Succeeded',
  'import.failed': 'Failed',
  'import.noRows': 'No valid rows found (make sure hotel_name and a price exist)',
  'import.importedN': '{n} rates imported',
  'import.failToast': 'Import failed',
  'common.saved': 'Saved',
}

const DICTS: Record<Lang, Record<string, string>> = { ar: AR, en: EN }

/** Pure translator usable outside React (e.g. deterministic export rendering). */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
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
  setLang: (l: Lang) => void
  toggle: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    const dir = dirFor(lang)
    const el = document.documentElement
    el.lang = lang
    el.dir = dir
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore storage failures */
    }
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggle = useCallback(() => setLangState((l) => (l === 'ar' ? 'en' : 'ar')), [])
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])

  const value = useMemo<I18nValue>(() => ({ lang, dir: dirFor(lang), setLang, toggle, t }), [lang, setLang, toggle, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
