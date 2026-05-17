import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, ArrowLeft, Check } from 'lucide-react';
import api from '../../utils/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  // Mode: 'login' or 'changePassword'
  const [mode, setMode] = useState('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleLanguage = () => {
    const newLang = isNepali ? 'en' : 'ne';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferredLanguage', newLang);
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err.response?.status === 401
          ? t('login.invalidCredentials')
          : t('login.loginFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate
    if (!username.trim()) {
      setError(t('login.usernameRequired'));
      return;
    }
    if (!currentPassword) {
      setError(t('login.currentPasswordRequired'));
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setError(t('login.newPasswordMin3'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('login.passwordsNoMatch'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/change-password', {
        username: username.trim(),
        currentPassword,
        newPassword,
      });
      setSuccess(t('login.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Switch back to login after 2 seconds
      setTimeout(() => {
        setPassword(''); // Clear so user enters new password
        switchMode('login');
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        t('login.changeFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 px-4 relative">
      {/* Language Toggle - Top Right */}
      <button
        onClick={toggleLanguage}
        className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white font-medium active:scale-95"
      >
        <Globe className="w-5 h-5" />
        <span className="font-bold">{isNepali ? 'EN' : 'ने'}</span>
      </button>

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        {/* Header */}
        {mode === 'changePassword' && (
          <button
            onClick={() => switchMode('login')}
            className="flex items-center text-gray-500 hover:text-gray-700 mb-4 -mt-2"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            {t('login.backToLogin')}
          </button>
        )}

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">
          {mode === 'login'
            ? t('login.title')
            : t('login.changePasswordTitle')}
        </h1>
        <p className="text-center text-gray-500 mb-6">
          {mode === 'login'
            ? t('login.subtitle')
            : t('login.changePasswordSubtitle')}
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center">
            <Check className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500"
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500"
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {loading
                ? t('login.loggingIn')
                : t('login.loginBtn')}
            </button>

            {/* Change Password Link */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('changePassword')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {t('login.changePasswordLink')}
              </button>
            </div>
          </form>
        )}

        {/* Change Password Form */}
        {mode === 'changePassword' && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500"
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.currentPassword')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500"
                placeholder={t('login.currentPasswordPlaceholder')}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500"
                placeholder={t('login.newPasswordPlaceholder')}
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.confirmNewPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500"
                placeholder={t('login.confirmPlaceholder')}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {loading
                ? t('login.changing')
                : t('login.changePasswordBtn')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
