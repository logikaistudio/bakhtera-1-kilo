import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

const STORAGE_KEY = 'bakhtera_language';
const SUPPORTED = ['en', 'id'];
const DEFAULT_LANG = 'en';

const LanguageContext = createContext(null);

const readStoredLanguage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return SUPPORTED.includes(stored) ? stored : DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
};

// Module-level language so non-React code (print templates, utils) can translate too.
let currentLanguage = readStoredLanguage();
if (typeof document !== 'undefined') document.documentElement.lang = currentLanguage;

const LEADING_ICON = /^([^\p{L}\p{N}\s]+\uFE0F?\s+)(.+)$/u;

/**
 * Text-as-key translation. The source text may be in either language; the dictionary
 * for the target language maps it to the target text. Unknown text is returned as-is,
 * so untranslated screens keep working. Supports {param} interpolation.
 */
export const translate = (text, params, lang = currentLanguage) => {
    if (typeof text !== 'string' || text === '') return text;
    const dict = translations[lang] || {};
    let result = dict[text];
    if (result === undefined) {
        const m = text.match(LEADING_ICON);
        if (m && dict[m[2]] !== undefined) result = m[1] + dict[m[2]];
    }
    if (result === undefined) result = text;
    if (!params) return result;
    return Object.entries(params).reduce(
        (out, [name, value]) => out.split(`{${name}}`).join(String(value)),
        result
    );
};

export const getLanguage = () => currentLanguage;

export const LanguageProvider = ({ children }) => {
    const [language, setLanguageState] = useState(currentLanguage);

    const setLanguage = useCallback((lang) => {
        if (!SUPPORTED.includes(lang)) return;
        currentLanguage = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
        document.documentElement.lang = lang;
        setLanguageState(lang);
    }, []);

    const value = useMemo(() => ({
        language,
        setLanguage,
        t: (text, params) => translate(text, params, language),
    }), [language, setLanguage]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
};
