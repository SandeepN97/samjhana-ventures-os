import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Globe,
  User,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Check,
  UserPlus,
  Users,
  Trash2,
  X,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import SearchableSelect from '../components/SearchableSelect';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';
  const { toasts, showToast, removeToast } = useToast();

  // Active section: null, 'editProfile', 'changePassword'
  const [activeSection, setActiveSection] = useState(null);

  // Demo reset state
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [demoResetting, setDemoResetting] = useState(false);

  // Edit Profile state
  const [profileFullName, setProfileFullName] = useState(user.fullName || '');
  const [profileFullNameNe, setProfileFullNameNe] = useState(user.fullNameNepali || '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [showNewUserPwConfirm, setShowNewUserPwConfirm] = useState(false);
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // User management state
  const [users, setUsers] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    fullName: '',
    fullNameNepali: '',
    role: 'STAFF'
  });
  const [submitting, setSubmitting] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchStaff();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/api/admin/users', { skipAuthRedirect: true });
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await api.get('/api/staff', { skipAuthRedirect: true });
      setStaffList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch staff', err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (staffList.length > 0 && !selectedStaffId) {
      showToast(isNepali ? 'पहिले कर्मचारी छान्नुहोस्' : 'Please select a staff member first', 'error');
      return;
    }
    if (!newUser.username.trim()) {
      showToast(t('settings.usernameRequired'), 'error');
      return;
    }
    if (!newUser.password || newUser.password.length < 3) {
      showToast(t('settings.passwordMin3'), 'error');
      return;
    }
    if (newUser.password !== newUserPasswordConfirm) {
      showToast(t('settings.passwordsNoMatch'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/admin/users', newUser);
      showToast(t('settings.userCreated'), 'success');
      setNewUser({ username: '', password: '', fullName: '', fullNameNepali: '', role: 'STAFF' });
      setNewUserPasswordConfirm('');
      setSelectedStaffId('');
      setShowUserForm(false);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(`Deactivate ${username}?`)) return;

    try {
      await api.delete(`/api/admin/users/${username}`);
      showToast(isNepali ? 'प्रयोगकर्ता निष्क्रिय गरियो' : 'User deactivated', 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate user', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileFullName.trim()) {
      showToast(t('settings.fullNameRequired'), 'error');
      return;
    }

    setProfileSaving(true);
    try {
      await api.put('/api/auth/profile', {
        fullName: profileFullName.trim(),
        fullNameNepali: profileFullNameNe.trim() || null,
      });

      const updatedUser = { ...user, fullName: profileFullName.trim(), fullNameNepali: profileFullNameNe.trim() };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      showToast(t('settings.profileUpdated'), 'success');
      setTimeout(() => setActiveSection(null), 1000);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      showToast(t('settings.currentPasswordRequired'), 'error');
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      showToast(t('settings.newPasswordMin3'), 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(t('settings.passwordsMismatch'), 'error');
      return;
    }

    setPwSaving(true);
    try {
      await api.post('/api/auth/change-password', {
        username: user.username,
        currentPassword,
        newPassword,
      });

      showToast(t('settings.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setActiveSection(null);
      }, 1500);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwSaving(false);
    }
  };


  const getRoleLabel = (role) => {
    const labels = {
      ADMIN: t('settings.roleAdmin'),
      MANAGER: t('settings.roleManager'),
      STAFF: t('settings.roleStaff')
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'bg-red-100 text-red-700',
      MANAGER: 'bg-green-100 text-green-700',
      STAFF: 'bg-gray-100 text-gray-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleDemoReset = async () => {
    setDemoResetting(true);
    setShowDemoConfirm(false);
    try {
      await api.post('/api/admin/demo-reset', null, { skipAuthRedirect: true });
      // Re-login as demo user automatically
      const loginRes = await api.post('/api/auth/login', { username: 'demo', password: 'demo' }, { skipAuthRedirect: true });
      localStorage.setItem('token', loginRes.data.token);
      localStorage.setItem('user', JSON.stringify(loginRes.data.user));
      showToast('Demo data loaded. Welcome back!', 'success');
      setTimeout(() => navigate('/', { replace: true }), 800);
    } catch (err) {
      showToast(err.response?.data?.error || 'Reset failed', 'error');
    } finally {
      setDemoResetting(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = isNepali ? 'en' : 'ne';
    i18n.changeLanguage(newLang);
    localStorage.setItem('preferredLanguage', newLang);
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-gray-800 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => activeSection ? setActiveSection(null) : navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold ml-3">
              {activeSection === 'editProfile'
                ? t('settings.editProfile')
                : activeSection === 'changePassword'
                ? t('settings.changePassword')
                : t('settings.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Edit Profile Section */}
      {activeSection === 'editProfile' && (
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {profileFullName?.charAt(0) || user.username?.charAt(0) || 'U'}
                </span>
              </div>
            </div>

            {/* Username (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('settings.username')}
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.fullNameEnglish')} *
              </label>
              <input
                type="text"
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full name"
              />
            </div>

            {/* Full Name Nepali */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.fullNameNepali')}
              </label>
              <input
                type="text"
                value={profileFullNameNe}
                onChange={(e) => setProfileFullNameNe(e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="पूरा नाम"
              />
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('settings.role')}
              </label>
              <div className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50">
                <span className={`text-sm px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg text-white transition-all active:scale-95 ${
                profileSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {profileSaving ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {t('settings.saveChanges')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Change Password Section */}
      {activeSection === 'changePassword' && (
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.currentPassword')} *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showCurrentPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.newPassword')} *
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showNewPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.confirmPassword')} *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••"
              />
              {confirmPassword && newPassword && confirmPassword !== newPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {t('settings.passwordsMismatch')}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleChangePassword}
              disabled={pwSaving}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg text-white transition-all active:scale-95 ${
                pwSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {pwSaving ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  {t('settings.changePasswordBtn')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Settings View */}
      {!activeSection && (
        <>
          {/* User Profile Card */}
          <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {user.fullName?.charAt(0) || user.username?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">
                  {user.fullName || user.username}
                </p>
                <p className="text-sm text-gray-500">{getRoleLabel(user.role)}</p>
                <p className="text-xs text-gray-400">@{user.username}</p>
              </div>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="px-4 mt-6 space-y-4">
            {/* Preferences */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-bold text-gray-700 text-sm uppercase">
                  {t('settings.preferences')}
                </h2>
              </div>

              {/* Language */}
              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{t('settings.language')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{t('settings.languageName')}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>


            </div>

            {/* Account */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-bold text-gray-700 text-sm uppercase">
                  {t('settings.account')}
                </h2>
              </div>

              <button
                onClick={() => setActiveSection('editProfile')}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{t('settings.editProfile')}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={() => setActiveSection('changePassword')}
                className="w-full flex items-center justify-between px-4 py-4 border-t hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{t('settings.changePassword')}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* User Management - Admin Only */}
            {isAdmin && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase">
                    {t('settings.userManagement')}
                  </h2>
                  <button
                    onClick={() => setShowUserForm(!showUserForm)}
                    className="flex items-center gap-1 text-blue-600 text-sm font-medium"
                  >
                    {showUserForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showUserForm ? t('settings.close') : t('settings.add')}
                  </button>
                </div>

                {/* Add User Form */}
                {showUserForm && (
                  <div className="p-4 border-b bg-blue-50">
                    <h3 className="font-bold text-gray-800 mb-3">
                      {t('settings.addNewUser')}
                    </h3>


                    <form onSubmit={handleCreateUser} className="space-y-3">
                      {/* Step 1: Pick staff member */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isNepali ? 'कर्मचारी' : 'Staff Member'} <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={selectedStaffId}
                          onChange={(val) => {
                            setSelectedStaffId(val);
                            const staff = staffList.find(s => String(s.id) === String(val));
                            if (staff) {
                              const roleMap = { MANAGER: 'MANAGER' };
                              const systemRole = roleMap[staff.staffRole] || 'STAFF';
                              setNewUser(prev => ({
                                ...prev,
                                fullName: staff.fullName || '',
                                fullNameNepali: staff.fullNameNepali || '',
                                role: systemRole,
                              }));
                            } else {
                              setNewUser(prev => ({ ...prev, fullName: '', fullNameNepali: '', role: 'STAFF' }));
                            }
                          }}
                          options={[
                            { value: '', label: isNepali ? '— कर्मचारी छान्नुहोस् —' : '— Select a staff member —' },
                            ...staffList.map(s => ({
                              value: String(s.id),
                              label: `${s.fullName}${s.staffRole ? ` · ${s.staffRole}` : ''}${s.businessUnit ? ` (${s.businessUnit})` : ''}`,
                            }))
                          ]}
                          placeholder={isNepali ? 'कर्मचारी खोज्नुहोस्' : 'Search staff...'}
                        />
                      </div>

                      {/* Staff info card — shown after selection */}
                      {selectedStaffId && (() => {
                        const staff = staffList.find(s => String(s.id) === String(selectedStaffId));
                        if (!staff) return null;
                        return (
                          <div className="bg-white border-2 border-blue-200 rounded-lg px-3 py-2 flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="font-bold text-blue-600 text-sm">
                                {staff.fullName?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm truncate">{staff.fullName}</p>
                              {staff.fullNameNepali && (
                                <p className="text-xs text-gray-500 truncate">{staff.fullNameNepali}</p>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                {staff.staffRole && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    {staff.staffRole}
                                  </span>
                                )}
                                {staff.businessUnit && (
                                  <span className="text-xs text-gray-400">{staff.businessUnit}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                newUser.role === 'ADMIN' ? 'bg-red-100 text-red-700'
                                : newUser.role === 'MANAGER' ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {getRoleLabel(newUser.role)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Step 2: Set login credentials — only show after staff is picked */}
                      {selectedStaffId && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('settings.role')} <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={newUser.role}
                              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            >
                              <option value="STAFF">{t('settings.staffRoleLabel')}</option>
                              <option value="MANAGER">{t('settings.managerRoleLabel')}</option>
                              <option value="ADMIN">{t('settings.adminRoleLabel')}</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('settings.username')} <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={newUser.username}
                              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              placeholder={t('settings.username')}
                              autoComplete="off"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('settings.password')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showNewUserPw ? 'text' : 'password'}
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                                placeholder={t('settings.password')}
                                autoComplete="new-password"
                              />
                              <button type="button" className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowNewUserPw(!showNewUserPw)}>
                                {showNewUserPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('settings.confirmPassword')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showNewUserPwConfirm ? 'text' : 'password'}
                                value={newUserPasswordConfirm}
                                onChange={(e) => setNewUserPasswordConfirm(e.target.value)}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                                placeholder={t('settings.repeatPassword')}
                                autoComplete="new-password"
                              />
                              <button type="button" className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowNewUserPwConfirm(!showNewUserPwConfirm)}>
                                {showNewUserPwConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedStaffId && (
                        <button
                          type="submit"
                          disabled={submitting}
                          className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                            submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {submitting
                            ? t('settings.creating')
                            : t('settings.createUser')}
                        </button>
                      )}
                    </form>
                  </div>
                )}

                {/* User List */}
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500">
                    {t('settings.noUsers')}
                  </div>
                ) : (
                  <div className="divide-y">
                    {users.map((u) => (
                      <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="font-bold text-gray-600">
                            {u.fullName?.charAt(0) || u.username?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{u.fullName || u.username}</p>
                          <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(u.role)}`}>
                            {getRoleLabel(u.role)}
                          </span>
                          {u.role !== 'ADMIN' && (
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Support */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-bold text-gray-700 text-sm uppercase">
                  {t('settings.support')}
                </h2>
              </div>

              <div className="px-4 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <HelpCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800 font-medium">{t('settings.helpSupport')}</span>
                </div>
                <p className="text-sm text-gray-500 ml-8">
                  {t('settings.helpContactMsg')}
                </p>
              </div>
            </div>

            {/* Demo Data Reset — admin only */}
            {isAdmin && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-amber-200">
                <div className="px-4 py-3 border-b bg-amber-50 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-800 text-sm uppercase tracking-wide">Demo / Testing</span>
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Clears all data and loads realistic demo data across all business units. You will be logged out automatically.
                  </p>
                  {!showDemoConfirm ? (
                    <button
                      onClick={() => setShowDemoConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset to Demo Data
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-red-600 text-center">Are you sure? This will delete all existing data.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDemoConfirm(false)}
                          className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDemoReset}
                          disabled={demoResetting}
                          className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {demoResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                          {demoResetting ? 'Resetting…' : 'Yes, Reset'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full bg-white rounded-xl shadow-sm px-4 py-4 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-bold">{t('settings.logout')}</span>
            </button>

            {/* App Version */}
            <div className="text-center text-gray-400 text-sm py-4">
              <p>Samjhana Ventures OS</p>
              <p>v1.0.0</p>
            </div>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
