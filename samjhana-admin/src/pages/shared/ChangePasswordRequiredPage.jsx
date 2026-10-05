import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import api from '../../utils/api';
import { clearSignIn } from '../../utils/session';
import { isAcceptableNewPassword } from '../../utils/passwordPolicy';
import LanguageToggle from '../../components/LanguageToggle';

/**
 * Where someone lands after an admin reset their password: they type the temporary password they were given and
 * choose their own. The server refuses everything else until this is done (see JwtAuthFilter), so this page cannot
 * be skipped by typing another address.
 */
export default function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();

  const [temporary, setTemporary] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!temporary) return setError(t('settings.currentPasswordRequired'));
    if (!isAcceptableNewPassword(newPassword)) return setError(t('forcedPassword.tooShort'));
    if (newPassword === temporary) return setError(t('forcedPassword.same'));
    if (newPassword !== confirm) return setError(t('forcedPassword.mismatch'));

    setSaving(true);
    try {
      const res = await api.post('/api/auth/change-password', {
        username: user.username,
        currentPassword: temporary,
        newPassword,
      }, { skipAuthRedirect: true });
      if (res?.data?.token) localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify({ ...user, mustChangePassword: false }));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t('settings.passwordChangeFailed', 'Failed to change password'));
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    clearSignIn();
    navigate('/login', { replace: true });
  };

  const field = 'w-full min-h-[44px] rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-core-500 focus:outline-none';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <KeyRound className="h-8 w-8 text-core-600" aria-hidden="true" />
          <LanguageToggle />
        </div>
        <h1 className="text-xl font-bold text-gray-800">{t('forcedPassword.title')}</h1>
        <p className="text-sm text-gray-600">{t('forcedPassword.intro')}</p>

        {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <label className="block text-sm font-medium text-gray-700">
          {t('forcedPassword.temporary')}
          <input type={show ? 'text' : 'password'} value={temporary} onChange={(e) => setTemporary(e.target.value)}
            className={field} autoComplete="current-password" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          {t('forcedPassword.newPassword')}
          <input type={show ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className={field} autoComplete="new-password" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          {t('forcedPassword.confirm')}
          <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className={field} autoComplete="new-password" />
        </label>

        <button type="button" onClick={() => setShow(!show)}
          className="flex min-h-[44px] items-center gap-2 text-sm text-gray-600" aria-pressed={show}>
          {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          {show ? t('forcedPassword.hide') : t('forcedPassword.show')}
        </button>

        <button type="submit" disabled={saving}
          className={`min-h-[44px] w-full rounded-lg font-bold text-white ${saving ? 'bg-gray-400' : 'bg-core-600 hover:bg-core-700'}`}>
          {saving ? t('forcedPassword.saving') : t('forcedPassword.submit')}
        </button>
        <button type="button" onClick={signOut} className="min-h-[44px] w-full text-sm text-gray-600 underline">
          {t('forcedPassword.signOut')}
        </button>
      </form>
    </div>
  );
}
