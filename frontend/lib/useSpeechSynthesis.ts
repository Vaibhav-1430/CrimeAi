"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LangCode } from "@/lib/languages";
import { LANGUAGES } from "@/lib/languages";

export interface UseSpeechSynthesis {
  supported: boolean;
  speaking: boolean;
  speak: (text: string, lang: LangCode) => void;
  cancel: () => void;
}

/** Browser text-to-speech (Web Speech API) for English/Hindi/Kannada. */
export function useSpeechSynthesis(): UseSpeechSynthesis {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    setSupported(true);

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, lang: LangCode) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const locale = LANGUAGES[lang].locale;
    utterance.lang = locale;

    // Prefer a voice matching the locale (or its base language) if available.
    const match = voicesRef.current.find(
      (voice) => voice.lang === locale || voice.lang.startsWith(`${lang}-`) || voice.lang === lang
    );
    if (match) {
      utterance.voice = match;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}
