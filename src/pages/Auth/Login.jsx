import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, LogIn, Lock, User, AlertCircle } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

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
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#050508]">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[150px]" />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `linear-gradient(rgba(96,165,250,1) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            <div className="relative w-full max-w-md px-4">

                {/* Logo area */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30 mb-4">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L18 3L30 9V17C30 23.627 24.627 29 18 29C11.373 29 6 23.627 6 17V9Z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M12 18L16 22L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Bakhtera<span className="text-blue-400">-1</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Freight Management Portal</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/60 p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-white">Masuk ke Akun Anda</h2>
                        <p className="text-sm text-slate-400 mt-1">Masukkan kredensial untuk melanjutkan</p>
                    </div>

                    {/* Error alert */}
                    {error && (
                        <div className="flex items-start gap-3 mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username field */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <User className="w-4 h-4 text-slate-500" />
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
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4 text-slate-500" />
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
                                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
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
                            className="w-full mt-2 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent"
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
                    <p className="text-center text-xs text-slate-600 mt-6">
                        Lupa password? Hubungi&nbsp;
                        <span className="text-slate-500 font-medium">Super Admin</span>
                    </p>
                </div>

                {/* Bottom branding */}
                <p className="text-center text-xs text-slate-700 mt-6">
                    © 2024 Bakhtera-1 &nbsp;•&nbsp; Powered by&nbsp;
                    <a href="https://logikai.studio" target="_blank" rel="noopener noreferrer" className="text-orange-500/70 hover:text-orange-400 transition-colors">
                        LogikAi.studio
                    </a>
                </p>
            </div>
        </div>
    );
};

export default Login;
