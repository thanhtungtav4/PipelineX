import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import vi from "../locales/vi.json";
import zhHans from "../locales/zh-Hans.json";
import zhHant from "../locales/zh-Hant.json";

export const SUPPORTED_LANGS = ["en", "vi", "zh-Hans", "zh-Hant"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export function initI18n(lang: SupportedLang = "en") {
  if (i18n.isInitialized) return i18n;
  i18n.use(initReactI18next).init({
    lng: lang,
    fallbackLng: "en",
    resources: {
      en: { translation: en },
      vi: { translation: vi },
      "zh-Hans": { translation: zhHans },
      "zh-Hant": { translation: zhHant },
    },
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export default i18n;
