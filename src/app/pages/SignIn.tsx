import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

export const SignIn = () => {
  const navigate = useNavigate();
  const { signIn, isAuthenticated } = useAuth();
  const { t, toggleLocale, locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError(t('fillCredentials'));
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-emerald-100 shadow-xl p-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-emerald-900">{t('signIn')}</h1>
            <p className="text-sm text-gray-500 mt-2">{t('accessWorkspace')}</p>
          </div>
          <div className="text-right">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
              English / Français
            </div>
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
              aria-label={t('language')}
            >
              {locale === 'en' ? 'ENG' : 'FR'}
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="name@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-semibold py-2.5 transition-colors"
          >
            {isSubmitting ? t('signingIn') : t('signIn')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('dontHaveAccount')} {' '}
          <Link to="/signup" className="text-emerald-700 hover:text-emerald-800 font-semibold">{t('signUp')}</Link>
        </p>
      </div>
    </div>
  );
};
