import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from './LanguageContext';

/** Compact EN | ID toggle. Variants: 'dark' (sidebar) or 'light' (login card). */
const LanguageSwitcher = ({ variant = 'dark', className = '' }) => {
    const { language, setLanguage } = useLanguage();
    const isDark = variant === 'dark';

    const btn = (code, label) => {
        const active = language === code;
        const activeCls = isDark ? 'bg-white/20 text-white' : 'bg-blue-600 text-white';
        const idleCls = isDark ? 'text-silver-dark hover:text-white' : 'text-gray-500 hover:text-gray-800';
        return (
            <button
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={active}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${active ? activeCls : idleCls}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <Languages className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-silver-dark' : 'text-gray-400'}`} />
            <div className={`flex items-center rounded-lg p-0.5 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                {btn('en', 'EN')}
                {btn('id', 'ID')}
            </div>
        </div>
    );
};

export default LanguageSwitcher;
