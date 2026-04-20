import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseStatus } from '../../lib/supabase';
import { Eye, EyeOff, LogIn, Lock, User, AlertCircle } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const supabaseStatus = getSupabaseStatus();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(username, password);

            if (result.success) {
                if (result.requiresPasswordChange) {
                    navigate('/change-password');
                } else {
                    navigate('/');
                }
            } else {
                setError(result.error || 'Login gagal. Periksa kembali username dan password Anda.');
            }
        } catch (err) {
            setError('Terjadi kesalahan. Silakan coba lagi.');
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen relative flex items-center justify-center overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #1a4b8c 30%, #2563eb 60%, #3b82f6 100%)',
            }}
        >
            {/* Decorative shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -left-32 w-80 h-80 bg-white/10 rounded-full blur-[80px]" />
                <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-300/15 rounded-full blur-[100px]" />
                <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px]" />
                {/* Subtle wave pattern */}
                <svg className="absolute bottom-0 left-0 w-full opacity-[0.06]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="white" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
                </svg>
            </div>

            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }}
            />

            <div className="relative w-full max-w-md px-4">

                {/* Logo area */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg shadow-blue-900/30 mb-4">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L18 3L30 9V17C30 23.627 24.627 29 18 29C11.373 29 6 23.627 6 17V9Z" fill="#2563eb" fillOpacity="0.15" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M12 18L16 22L24 14" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">
                        Bakhtera<span className="text-cyan-300">-1</span>
                    </h1>
                    <p className="text-sm text-blue-100/80 mt-1 font-medium">Freight Management Portal</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl bg-white shadow-2xl shadow-blue-900/40 p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-800">Masuk ke Akun Anda</h2>
                        <p className="text-sm text-gray-500 mt-1">Masukkan kredensial untuk melanjutkan</p>
                    </div>

                    {/* Error alert */}
                    {error && (
                        <div className="flex items-start gap-3 mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username field */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <User className="w-4 h-4 text-blue-400" />
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={loading}
                                    placeholder="Masukkan username"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4 text-blue-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    placeholder="Masukkan password"
                                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-blue-500 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Memproses...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4" />
                                    <span>Masuk</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer note */}
                    <p className="text-center text-xs text-gray-400 mt-6">
                        Lupa password? Hubungi&nbsp;
                        <span className="text-blue-500 font-medium">Super Admin</span>
                    </p>

                    {/* Runtime Supabase status */}
                    <div className="mt-6 p-4 rounded-xl border border-blue-100 bg-blue-50 text-sm text-blue-700">
                        <div className="font-semibold mb-2">Status Supabase Runtime</div>
                        <div className="space-y-1 text-xs">
                            <div>
                                <span className="font-medium">Configured:</span>{' '}
                                {supabaseStatus.configured ? '✔️ Ya' : '⚠️ Tidak'}
                            </div>
                            <div>
                                <span className="font-medium">URL source:</span>{' '}
                                {supabaseStatus.url ? 'VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL' : 'none'}
                            </div>
                            <div>
                                <span className="font-medium">Key source:</span>{' '}
                                {supabaseStatus.keySource}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom branding */}
                <p className="text-center text-xs text-blue-200/60 mt-6">
                    © 2024 Bakhtera-1 &nbsp;•&nbsp; Powered by&nbsp;
                    <a href="https://logikai.studio" target="_blank" rel="noopener noreferrer" className="text-cyan-300/80 hover:text-cyan-200 transition-colors">
                        LogikAi.studio
                    </a>
                </p>
            </div>
        </div>
    );
};

export default Login;

