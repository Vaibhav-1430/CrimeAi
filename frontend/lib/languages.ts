export type LangCode = "en" | "hi" | "kn";

export interface LanguageConfig {
  code: LangCode;
  label: string;
  nativeLabel: string;
  /** BCP-47 locale for the Web Speech API (recognition + synthesis). */
  locale: string;
}

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  en: { code: "en", label: "English", nativeLabel: "English", locale: "en-IN" },
  hi: { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", locale: "hi-IN" },
  kn: { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", locale: "kn-IN" }
};

export const LANGUAGE_LIST = Object.values(LANGUAGES);

// UI strings localized for the three supported languages.
export const UI_STRINGS: Record<LangCode, Record<string, string>> = {
  en: {
    title: "AI Investigation Assistant",
    placeholder: "Ask about a case, evidence, suspects, or trends…",
    listening: "Listening…",
    speak: "Speak responses",
    voiceInput: "Voice input",
    emptyHeading: "How can I assist your investigation?",
    emptySub: "Ask by voice or text — in English, Hindi, or Kannada."
  },
  hi: {
    title: "एआई जांच सहायक",
    placeholder: "किसी केस, साक्ष्य, संदिग्ध या रुझान के बारे में पूछें…",
    listening: "सुन रहा हूँ…",
    speak: "उत्तर बोलें",
    voiceInput: "आवाज़ इनपुट",
    emptyHeading: "मैं आपकी जांच में कैसे मदद कर सकता हूँ?",
    emptySub: "आवाज़ या टेक्स्ट से पूछें — अंग्रेज़ी, हिंदी या कन्नड़ में।"
  },
  kn: {
    title: "ಎಐ ತನಿಖಾ ಸಹಾಯಕ",
    placeholder: "ಪ್ರಕರಣ, ಸಾಕ್ಷ್ಯ, ಶಂಕಿತರು ಅಥವಾ ಪ್ರವೃತ್ತಿಗಳ ಬಗ್ಗೆ ಕೇಳಿ…",
    listening: "ಆಲಿಸುತ್ತಿದೆ…",
    speak: "ಉತ್ತರಗಳನ್ನು ಮಾತನಾಡಿ",
    voiceInput: "ಧ್ವನಿ ಇನ್‌ಪುಟ್",
    emptyHeading: "ನಿಮ್ಮ ತನಿಖೆಗೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
    emptySub: "ಧ್ವನಿ ಅಥವಾ ಪಠ್ಯದ ಮೂಲಕ ಕೇಳಿ — ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ."
  }
};

export function t(lang: LangCode, key: string): string {
  return UI_STRINGS[lang]?.[key] ?? UI_STRINGS.en[key] ?? key;
}
