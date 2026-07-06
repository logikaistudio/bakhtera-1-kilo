import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { forgotPasswordSelfService } from '../../services/userService';
import { Eye, EyeOff, LogIn, Lock, User, AlertCircle } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotFullName, setForgotFullName] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
    const [generatedPassword, setGeneratedPassword] = useState('');
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

    const openForgotModal = () => {
        setShowForgotModal(true);
        setForgotUsername(username || '');
        setForgotFullName('');
        setForgotError('');
        setForgotSuccessMessage('');
        setGeneratedPassword('');
    };

    const closeForgotModal = () => {
        setShowForgotModal(false);
        setForgotError('');
        setForgotSuccessMessage('');
        setGeneratedPassword('');
        setForgotLoading(false);
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccessMessage('');
        setGeneratedPassword('');
        setForgotLoading(true);

        try {
            const result = await forgotPasswordSelfService(forgotUsername, forgotFullName);
            if (!result.success) {
                setForgotError(result.error || 'Reset password gagal. Periksa data verifikasi Anda.');
                return;
            }

            setForgotSuccessMessage(result.message || 'Password baru berhasil dibuat.');
            setGeneratedPassword(result.generatedPassword || '');
            setPassword(result.generatedPassword || '');
            setUsername(forgotUsername);
        } catch (err) {
            console.error('Forgot password error:', err);
            setForgotError('Terjadi kesalahan saat reset password. Silakan coba lagi.');
        } finally {
            setForgotLoading(false);
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
                    <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">
                        Bakhtera<span className="text-orange-400">One</span>
                    </h1>
                    <p className="text-sm text-blue-100/80 mt-1 font-medium">Freight Management Portal</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl bg-white shadow-2xl shadow-blue-900/40 p-8">
                    <div className="mb-4 flex items-center justify-center">
                        <img
                            src="/logo%20bakhtera%20lama.png"
                            alt="Bakhtera Worldwide"
                            className="h-12 w-auto drop-shadow-md"
                        />
                    </div>
                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-semibold text-gray-800">Login</h2>
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

                </div>

                {/* Bottom branding */}
                <p className="text-center text-xs text-blue-200/60 mt-6">
                    © 2026 BakhteraOne &nbsp;•&nbsp; Powered by&nbsp;
                    <a href="https://logikai.studio" target="_blank" rel="noopener noreferrer" className="text-orange-300/90 hover:text-orange-200 transition-colors">
                        LogikAi.studio
                    </a>
                </p>
            </div>

            {showForgotModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Reset Password Mandiri</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Verifikasi data Anda. Sistem akan membuat password baru tanpa email, lalu tampilkan di layar.
                        </p>

                        {forgotError && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {forgotError}
                            </div>
                        )}

                        {forgotSuccessMessage && (
                            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                <p>{forgotSuccessMessage}</p>
                                {generatedPassword && (
                                    <p className="mt-2 font-semibold">
                                        Password Baru: <span className="font-mono">{generatedPassword}</span>
                                    </p>
                                )}
                                <p className="mt-2 font-medium">
                                    Catat password ini sekarang, karena notifikasi hanya ditampilkan sekali di layar.
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleForgotPassword} className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
                                <input
                                    type="text"
                                    value={forgotUsername}
                                    onChange={(e) => setForgotUsername(e.target.value)}
                                    required
                                    disabled={forgotLoading}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={forgotFullName}
                                    onChange={(e) => setForgotFullName(e.target.value)}
                                    required
                                    disabled={forgotLoading}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={closeForgotModal}
                                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                                >
                                    Tutup
                                </button>
                                <button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {forgotLoading ? 'Memproses...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;

