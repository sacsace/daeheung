import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './ko';

export type AppLanguage = 'ko' | 'en';

const loadedLanguages = new Set<string>(['ko']);

/** OS/브라우저 언어: 한국어면 ko, 그 외는 모두 en */
export function detectOsLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return candidates.some((l) => l.startsWith('ko')) ? 'ko' : 'en';
}

/** 비활성 언어 번역은 필요 시에만 동적 로드 */
export async function ensureI18nLanguage(lang: AppLanguage): Promise<void> {
  if (!loadedLanguages.has(lang)) {
    const mod = lang === 'en' ? await import('./en') : await import('./ko');
    i18n.addResourceBundle(lang, 'translation', mod.default.translation, true, true);
    loadedLanguages.add(lang);
  }
  await i18n.changeLanguage(lang);
}

const SEO_FALLBACK: Record<AppLanguage, { title: string; description: string }> = {
  ko: {
    title: 'MVS - 통합 업무 관리 시스템',
    description: 'MVS - 차세대 기업용 통합 업무 관리 시스템',
  },
  en: {
    title: 'MVS - Integrated Business Management System',
    description: 'MVS - Next-generation enterprise business management system',
  },
};

/** 활성 UI 언어에 맞춰 SEO 메타(title/description/html lang) 동기화 */
export const syncDocumentSeo = (lng?: string) => {
  if (typeof document === 'undefined') return;
  const raw = String(lng || i18n.language || detectOsLanguage()).toLowerCase();
  const lang: AppLanguage = raw.startsWith('en') ? 'en' : 'ko';
  document.documentElement.lang = lang;

  const titleKey = i18n.t('seo.title', { lng: lang });
  const descKey = i18n.t('seo.description', { lng: lang });
  const title =
    titleKey && titleKey !== 'seo.title' ? titleKey : SEO_FALLBACK[lang].title;
  const description =
    descKey && descKey !== 'seo.description' ? descKey : SEO_FALLBACK[lang].description;

  document.title = title;
  const descTag = document.querySelector('meta[name="description"]');
  if (descTag) descTag.setAttribute('content', description);
};

const initialOsLang = detectOsLanguage();

// 언어는 OS 기본값 → 사용자 UI 설정(API / 메뉴 스토어)으로 동기화
i18n.use(initReactI18next).init({
    resources: {
    ko,
    },
  lng: initialOsLang,
  fallbackLng: initialOsLang === 'en' ? 'en' : 'ko',
    interpolation: {
    escapeValue: false,
    },
    react: {
    useSuspense: false,
  },
});

i18n.on('languageChanged', syncDocumentSeo);
// 영어 리소스 로드 전에도 타이틀/SEO가 영문으로 유지되도록 폴백 적용
syncDocumentSeo(initialOsLang);

/** React 렌더 전에 OS 언어(및 en 번들)를 준비 */
export async function bootstrapI18n(): Promise<AppLanguage> {
  const lang = detectOsLanguage();
  await ensureI18nLanguage(lang);
  syncDocumentSeo(lang);
  return lang;
}

export default i18n;
