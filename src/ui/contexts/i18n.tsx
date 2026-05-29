import React, { createContext, useContext, useState, useCallback } from "react";
import {
  initI18n,
  t,
  setThinkingLocale as setGlobalThinkingLocale,
  setReplyLocale as setGlobalReplyLocale,
  setEnhancedLangEnabled as setGlobalEnhancedLangEnabled,
  type Locale,
  type TranslationKey,
} from "../../common/i18n";

export type I18nContextValue = {
  t: (key: TranslationKey, params?: Record<string, string | number>, localeOverride?: Locale) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  thinkingLocale: Locale;
  replyLocale: Locale;
  setThinkingLocale: (locale: Locale) => void;
  setReplyLocale: (locale: Locale) => void;
  enhancedLangEnabled: boolean;
  setEnhancedLangEnabled: (enabled: boolean) => void;
};

const I18nContext = createContext<I18nContextValue>({
  t,
  locale: "en",
  setLocale: () => {},
  thinkingLocale: "en",
  replyLocale: "en",
  setThinkingLocale: () => {},
  setReplyLocale: () => {},
  enhancedLangEnabled: true,
  setEnhancedLangEnabled: () => {},
});

export function I18nProvider({
  children,
  initialLocale,
  initialThinkingLocale,
  initialReplyLocale,
  initialEnhancedLangEnabled,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
  initialThinkingLocale?: Locale;
  initialReplyLocale?: Locale;
  initialEnhancedLangEnabled?: boolean;
}): React.ReactElement {
  const [locale, setLocaleState] = useState(initialLocale);
  const [tLocale, setTLocaleState] = useState(initialThinkingLocale ?? initialLocale);
  const [rLocale, setRLocaleState] = useState(initialReplyLocale ?? initialLocale);
  const [enhancedState, setEnhancedState] = useState(initialEnhancedLangEnabled ?? true);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      initI18n(newLocale, { thinkingLocale: tLocale, replyLocale: rLocale });
      setLocaleState(newLocale);
    },
    [tLocale, rLocale]
  );

  const setThinkingLocale = useCallback((locale: Locale) => {
    setGlobalThinkingLocale(locale);
    setTLocaleState(locale);
  }, []);

  const setReplyLocale = useCallback((locale: Locale) => {
    setGlobalReplyLocale(locale);
    setRLocaleState(locale);
  }, []);

  const setEnhanced = useCallback((enabled: boolean) => {
    setGlobalEnhancedLangEnabled(enabled);
    setEnhancedState(enabled);
  }, []);

  return (
    <I18nContext.Provider
      value={{
        t,
        locale,
        setLocale,
        thinkingLocale: tLocale,
        replyLocale: rLocale,
        setThinkingLocale,
        setReplyLocale,
        enhancedLangEnabled: enhancedState,
        setEnhancedLangEnabled: setEnhanced,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
