import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const STORAGE_KEY = "elbakri.lang";

const dict = {
  ar: {
    "brand.tagline": "نظام أسعار الفنادق",
    "brand.company": "ELBAKRI OVER SEAS FOR TRAVEL",
    "nav.dashboard": "لوحة العمليات",
    "nav.hotels": "مكتبة الفنادق",
    "nav.groups": "المجموعات الفندقية",
    "nav.packages": "الباكدجات",
    "nav.sales": "عروض المبيعات",
    "nav.quotes": "عروض الأسعار",
    "nav.users": "المستخدمون",
    "nav.more": "المزيد",
    "nav.systemCheck": "فحص النظام",
    "auth.signout": "تسجيل الخروج",
    "auth.welcome": "مرحباً بك",
    "auth.subtitle": "سجل دخولك للوصول إلى لوحة التحكم",
    "auth.signin": "تسجيل الدخول",
    "auth.signup": "حساب جديد",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.fullname": "الاسم الكامل",
    "auth.enter": "دخول",
    "auth.entering": "جاري الدخول…",
    "auth.create": "إنشاء حساب",
    "auth.creating": "جاري الإنشاء…",
    "auth.hero.title": "نظام إدارة أسعار الفنادق",
    "auth.hero.desc": "بديل احترافي للإكسل لإدارة باكدجات الفنادق، تصدير العروض، وإعداد عروض الأسعار للعملاء بسرعة ودقة.",
    "auth.note": "أول حساب يتم إنشاؤه يصبح مديراً تلقائياً. باقي الحسابات تبدأ بصلاحية مبيعات.",
    "auth.fail.signin": "فشل تسجيل الدخول",
    "auth.fail.signup": "فشل إنشاء الحساب",
    "auth.ok.signin": "تم تسجيل الدخول بنجاح",
    "auth.ok.signup": "تم إنشاء الحساب. يمكنك تسجيل الدخول الآن.",
    "role.admin": "مدير النظام",
    "role.operations": "عمليات",
    "role.sales": "مبيعات",
    "role.viewer": "عرض فقط",
    "lang.toggle": "EN",
    "notfound.title": "الصفحة غير موجودة",
    "notfound.desc": "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    "notfound.home": "الرئيسية",
    "error.title": "تعذّر تحميل الصفحة",
    "error.desc": "حدث خطأ غير متوقع. حاول إعادة المحاولة أو العودة للرئيسية.",
    "error.retry": "إعادة المحاولة",
    "error.home": "الرئيسية",
  },
  en: {
    "brand.tagline": "Hotel Rates System",
    "brand.company": "ELBAKRI OVER SEAS FOR TRAVEL",
    "nav.dashboard": "Operations",
    "nav.hotels": "Hotel Library",
    "nav.groups": "Hotel Groups",
    "nav.packages": "Packages",
    "nav.sales": "Sales Offers",
    "nav.quotes": "Quotes",
    "nav.users": "Users",
    "nav.more": "More",
    "nav.systemCheck": "System Check",
    "auth.signout": "Sign out",
    "auth.welcome": "Welcome back",
    "auth.subtitle": "Sign in to access your dashboard",
    "auth.signin": "Sign in",
    "auth.signup": "Create account",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.fullname": "Full name",
    "auth.enter": "Sign in",
    "auth.entering": "Signing in…",
    "auth.create": "Create account",
    "auth.creating": "Creating…",
    "auth.hero.title": "Hotel Pricing Management System",
    "auth.hero.desc": "A professional Excel replacement for managing hotel packages, exporting offers, and preparing client quotes quickly and accurately.",
    "auth.note": "The first account created becomes the admin automatically. All other accounts start as Sales.",
    "auth.fail.signin": "Sign in failed",
    "auth.fail.signup": "Sign up failed",
    "auth.ok.signin": "Signed in successfully",
    "auth.ok.signup": "Account created. You can sign in now.",
    "role.admin": "Admin",
    "role.operations": "Operations",
    "role.sales": "Sales",
    "role.viewer": "Viewer",
    "lang.toggle": "ع",
    "notfound.title": "Page not found",
    "notfound.desc": "The page you're looking for doesn't exist or has been moved.",
    "notfound.home": "Go home",
    "error.title": "This page didn't load",
    "error.desc": "Something went wrong on our end. Try again or head back home.",
    "error.retry": "Try again",
    "error.home": "Go home",
  },
} as const;

export type TKey = keyof (typeof dict)["ar"];

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (k: TKey) => string;
  dir: "rtl" | "ltr";
}

const I18nCtx = createContext<Ctx | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored === "ar" || stored === "en") setLangState(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const value: Ctx = {
    lang,
    setLang,
    toggle: () => setLang(lang === "ar" ? "en" : "ar"),
    t: (k) => dict[lang][k] ?? dict.ar[k] ?? k,
    dir: lang === "ar" ? "rtl" : "ltr",
  };

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      className={
        "inline-flex items-center justify-center rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20 transition-colors " +
        (className ?? "")
      }
      aria-label="Toggle language"
      title={lang === "ar" ? "English" : "العربية"}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}