import React, { useEffect, useState } from "react";
import { useInput } from "ink";
import DropdownMenu from "../DropdownMenu";
import { t, type Locale } from "../../../common/i18n";

type ConfigStep = "category" | "language" | "toggle";

type CategoryKey = "locale" | "thinkingLocale" | "replyLocale" | "enhancedLangInstructions";

type CategoryOption = {
  key: CategoryKey;
  label: string;
  description: string;
};

function getLocaleDisplayName(locale: Locale): string {
  return locale === "en" ? t("ui.config.localeEn") : t("ui.config.localeZhCN");
}

function getCategoryOptions(
  currentLocale: Locale,
  currentThinkingLocale: Locale,
  currentReplyLocale: Locale,
  enhancedLangEnabled: boolean
): CategoryOption[] {
  return [
    {
      key: "locale",
      label: t("ui.config.language"),
      description: getLocaleDisplayName(currentLocale),
    },
    {
      key: "thinkingLocale",
      label: t("ui.config.thinkingLanguage"),
      description: getLocaleDisplayName(currentThinkingLocale),
    },
    {
      key: "replyLocale",
      label: t("ui.config.replyLanguage"),
      description: getLocaleDisplayName(currentReplyLocale),
    },
    {
      key: "enhancedLangInstructions",
      label: t("ui.config.enhancedLangInstructions"),
      description: enhancedLangEnabled
        ? t("ui.config.enhancedLangInstructionsEnabled")
        : t("ui.config.enhancedLangInstructionsDisabled"),
    },
  ];
}

const LOCALE_OPTIONS: { key: Locale }[] = [{ key: "en" }, { key: "zh-CN" }];

const TOGGLE_OPTIONS = [
  { key: true, labelKey: "ui.config.enhancedLangInstructionsEnabled" as const },
  { key: false, labelKey: "ui.config.enhancedLangInstructionsDisabled" as const },
];

type Props = {
  open: boolean;
  currentLocale: Locale;
  currentThinkingLocale: Locale;
  currentReplyLocale: Locale;
  enhancedLangEnabled: boolean;
  width: number;
  onClose: () => void;
  onLocaleChange: (locale: Locale) => void;
  onThinkingLocaleChange: (locale: Locale) => void;
  onReplyLocaleChange: (locale: Locale) => void;
  onEnhancedLangChange: (enabled: boolean) => void;
  onStatusMessage?: (message: string | null) => void;
};

const ConfigDropdown: React.FC<Props> = ({
  open,
  currentLocale,
  currentThinkingLocale,
  currentReplyLocale,
  enhancedLangEnabled,
  width,
  onClose,
  onLocaleChange,
  onThinkingLocaleChange,
  onReplyLocaleChange,
  onEnhancedLangChange,
  onStatusMessage,
}) => {
  const [step, setStep] = useState<ConfigStep | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  useEffect(() => {
    if (open) {
      setStep("category");
      setActiveIndex(0);
      setSelectedCategory(null);
    } else {
      setStep(null);
    }
  }, [open]);

  function getCurrentLocaleForCategory(category: CategoryKey): Locale {
    switch (category) {
      case "locale":
        return currentLocale;
      case "thinkingLocale":
        return currentThinkingLocale;
      case "replyLocale":
        return currentReplyLocale;
      case "enhancedLangInstructions":
        return "en"; // not used for toggle
    }
  }

  function handleSelect(): void {
    if (step === "category") {
      const category = getCategoryOptions(
        currentLocale,
        currentThinkingLocale,
        currentReplyLocale,
        enhancedLangEnabled
      )[activeIndex];
      if (!category) {
        return;
      }
      setSelectedCategory(category.key);
      if (category.key === "enhancedLangInstructions") {
        // Show toggle options
        const toggleIndex = TOGGLE_OPTIONS.findIndex((opt) => opt.key === enhancedLangEnabled);
        setActiveIndex(toggleIndex >= 0 ? toggleIndex : 0);
        setStep("toggle");
      } else {
        const currentValue = getCurrentLocaleForCategory(category.key);
        const localeIndex = LOCALE_OPTIONS.findIndex((opt) => opt.key === currentValue);
        setActiveIndex(localeIndex >= 0 ? localeIndex : 0);
        setStep("language");
      }
      return;
    }

    // Apply selected value
    if (selectedCategory === "enhancedLangInstructions") {
      const option = TOGGLE_OPTIONS[activeIndex];
      if (!option) {
        return;
      }
      onEnhancedLangChange(option.key);
      onStatusMessage?.(t("ui.config.enhancedLangInstructionsUpdated", { value: t(option.labelKey) }));
    } else {
      const locale = LOCALE_OPTIONS[activeIndex];
      if (!locale || !selectedCategory) {
        return;
      }
      const localeDisplay = getLocaleDisplayName(locale.key);
      switch (selectedCategory) {
        case "locale":
          onLocaleChange(locale.key);
          onStatusMessage?.(t("ui.config.languageUpdated", { locale: localeDisplay }));
          break;
        case "thinkingLocale":
          onThinkingLocaleChange(locale.key);
          onStatusMessage?.(t("ui.config.thinkingLanguageUpdated", { locale: localeDisplay }));
          break;
        case "replyLocale":
          onReplyLocaleChange(locale.key);
          onStatusMessage?.(t("ui.config.replyLanguageUpdated", { locale: localeDisplay }));
          break;
      }
    }
    // Return to category selection after applying
    setStep("category");
    setActiveIndex(0);
    setSelectedCategory(null);
  }

  useInput(
    (input, key) => {
      if (!step) {
        return;
      }

      const optionCount =
        step === "category"
          ? getCategoryOptions(currentLocale, currentThinkingLocale, currentReplyLocale, enhancedLangEnabled).length
          : step === "toggle"
            ? TOGGLE_OPTIONS.length
            : LOCALE_OPTIONS.length;

      if (key.upArrow) {
        setActiveIndex((idx) => (idx - 1 + optionCount) % optionCount);
        return;
      }
      if (key.downArrow) {
        setActiveIndex((idx) => (idx + 1) % optionCount);
        return;
      }
      if ((input === " " && !key.ctrl && !key.meta) || (key.return && !key.shift && !key.meta)) {
        handleSelect();
        return;
      }
      if (key.tab || key.escape) {
        if (step === "language" || step === "toggle") {
          setStep("category");
          setActiveIndex(0);
          return;
        }
        onClose();
        return;
      }
    },
    { isActive: open }
  );

  if (!open || !step) {
    return null;
  }

  const items =
    step === "category"
      ? getCategoryOptions(currentLocale, currentThinkingLocale, currentReplyLocale, enhancedLangEnabled).map(
          (option) => ({
            key: option.key,
            label: option.label,
            description: option.description,
            selected: false,
          })
        )
      : step === "toggle"
        ? TOGGLE_OPTIONS.map((option) => ({
            key: String(option.key),
            label: t(option.labelKey),
            description: option.key === enhancedLangEnabled ? t("ui.config.currentLabel") : "",
            selected: option.key === enhancedLangEnabled,
          }))
        : LOCALE_OPTIONS.map((option) => ({
            key: option.key,
            label: getLocaleDisplayName(option.key),
            description:
              option.key === getCurrentLocaleForCategory(selectedCategory!) ? t("ui.config.currentLabel") : "",
            selected: option.key === getCurrentLocaleForCategory(selectedCategory!),
          }));

  return (
    <DropdownMenu
      width={width}
      title={
        step === "category"
          ? t("ui.config.title")
          : step === "toggle"
            ? t("ui.config.enhancedLangInstructions")
            : t("ui.config.selectLanguage")
      }
      helpText={step === "category" ? t("ui.config.selectCategoryHelp") : t("ui.config.selectLanguageHelp")}
      items={items}
      activeIndex={activeIndex}
      activeColor="#229ac3"
      maxVisible={6}
    />
  );
};

export default ConfigDropdown;
