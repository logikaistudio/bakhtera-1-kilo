/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: false,
    theme: {
        extend: {
            colors: {
                'dark-bg': '#FFFFFF',
                'dark-surface': '#F2F3F4',
                'dark-card': '#F2F3F4',
                'dark-border': '#D1D5DB',

                // Text tones for light theme
                'silver': '#111827',
                'silver-light': '#1F2937',
                'silver-dark': '#4B5563',
                'silver-muted': '#6B7280',

                // Vibrant accent colors (light-friendly)
                'accent-blue': '#0070BB',
                'accent-purple': '#7C3AED',
                'accent-cyan': '#0891B2',
                'accent-green': '#059669',
                'accent-orange': '#EA580C',
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
            },
            fontSize: {
                'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
                'sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.005em' }],
                'base': ['1rem', { lineHeight: '1.6', letterSpacing: 'normal' }],
                'lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.01em' }],
                'xl': ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.015em' }],
                '2xl': ['1.5rem', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
                '3xl': ['1.875rem', { lineHeight: '1.3', letterSpacing: '-0.025em' }],
                '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0)' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 8px rgba(96, 165, 250, 0.3), 0 0 16px rgba(96, 165, 250, 0.15)' },
                    '100%': { boxShadow: '0 0 16px rgba(96, 165, 250, 0.5), 0 0 32px rgba(96, 165, 250, 0.25)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
