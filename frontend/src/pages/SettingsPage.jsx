import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Globe,
  User,
  Bell,
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
  Save
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  const [notifications, setNotifications] = useState(
    () => localStorage.getItem('notifications') !== 'false'
  );

  // Active section: null, 'editProfile', 'changePassword'
  const [activeSection, setActiveSection] = useState(null);

  // Edit Profile state
  const [profileFullName, setProfileFullName] = useState(user.fullName || '');
  const [profileFullNameNe, setProfileFullNameNe] = useState(user.fullNameNepali || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

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
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

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
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (!newUser.username.trim()) {
      setUserError(isNepali ? 'प्रयोगकर्ता नाम आवश्यक छ' : 'Username is required');
      return;
    }
    if (!newUser.password || newUser.password.length < 3) {
      setUserError(isNepali ? 'पासवर्ड कम्तिमा ३ अक्षर हुनुपर्छ' : 'Password must be at least 3 characters');
      return;
    }
    if (newUser.password !== newUserPasswordConfirm) {
      setUserError(isNepali ? 'पासवर्ड मेल खाएन' : 'Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/admin/users', newUser);
      setUserSuccess(isNepali ? 'प्रयोगकर्ता सिर्जना भयो!' : 'User created successfully!');
      setNewUser({ username: '', password: '', fullName: '', fullNameNepali: '', role: 'STAFF' });
      setNewUserPasswordConfirm('');
      fetchUsers();
      setTimeout(() => {
        setShowUserForm(false);
        setUserSuccess('');
      }, 1500);
    } catch (err) {
      setUserError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(isNepali ? `${username} लाई हटाउने?` : `Deactivate ${username}?`)) return;

    try {
      await api.delete(`/api/admin/users/${username}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleSaveProfile = async () => {
    setProfileMsg({ type: '', text: '' });
    if (!profileFullName.trim()) {
      setProfileMsg({ type: 'error', text: isNepali ? 'पूरा नाम आवश्यक छ' : 'Full name is required' });
      return;
    }

    setProfileSaving(true);
    try {
      await api.put('/api/auth/profile', {
        fullName: profileFullName.trim(),
        fullNameNepali: profileFullNameNe.trim() || null,
      });

      // Update localStorage
      const updatedUser = { ...user, fullName: profileFullName.trim(), fullNameNepali: profileFullNameNe.trim() };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setProfileMsg({ type: 'success', text: isNepali ? 'प्रोफाइल अपडेट भयो!' : 'Profile updated!' });
      setTimeout(() => {
        setActiveSection(null);
        setProfileMsg({ type: '', text: '' });
      }, 1500);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg({ type: '', text: '' });

    if (!currentPassword) {
      setPwMsg({ type: 'error', text: isNepali ? 'हालको पासवर्ड आवश्यक छ' : 'Current password is required' });
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setPwMsg({ type: 'error', text: isNepali ? 'नयाँ पासवर्ड कम्तिमा ३ अक्षर हुनुपर्छ' : 'New password must be at least 3 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: isNepali ? 'पासवर्ड मिलेन' : 'Passwords do not match' });
      return;
    }

    setPwSaving(true);
    try {
      await api.post('/api/auth/change-password', {
        username: user.username,
        currentPassword,
        newPassword,
      });

      setPwMsg({ type: 'success', text: isNepali ? 'पासवर्ड परिवर्तन भयो!' : 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setActiveSection(null);
        setPwMsg({ type: '', text: '' });
      }, 1500);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setPwSaving(false);
    }
  };

  const handleNotificationToggle = () => {
    const newVal = !notifications;
    setNotifications(newVal);
    localStorage.setItem('notifications', newVal.toString());
  };

  const getRoleLabel = (role) => {
    const labels = {
      ADMIN: isNepali ? 'एडमिन' : 'Admin',
      DAD: isNepali ? 'बुबा' : 'Dad',
      SON: isNepali ? 'छोरा' : 'Son',
      STAFF: isNepali ? 'कर्मचारी' : 'Staff'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'bg-red-100 text-red-700',
      DAD: 'bg-blue-100 text-blue-700',
      SON: 'bg-green-100 text-green-700',
      STAFF: 'bg-gray-100 text-gray-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
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
                ? (isNepali ? 'प्रोफाइल सम्पादन' : 'Edit Profile')
                : activeSection === 'changePassword'
                ? (isNepali ? 'पासवर्ड परिवर्तन' : 'Change Password')
                : (isNepali ? 'सेटिंग्स' : 'Settings')}
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

            {profileMsg.text && (
              <div className={`px-3 py-2 rounded-lg text-sm flex items-center ${
                profileMsg.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'
              }`}>
                {profileMsg.type === 'success' && <Check className="w-4 h-4 mr-1" />}
                {profileMsg.text}
              </div>
            )}

            {/* Username (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {isNepali ? 'प्रयोगकर्ता नाम' : 'Username'}
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
                {isNepali ? 'पूरा नाम (English)' : 'Full Name (English)'} *
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
                {isNepali ? 'पूरा नाम (नेपाली)' : 'Full Name (Nepali)'}
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
                {isNepali ? 'भूमिका' : 'Role'}
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
                  {isNepali ? 'सेभ गर्नुहोस्' : 'Save Changes'}
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
            {pwMsg.text && (
              <div className={`px-3 py-2 rounded-lg text-sm flex items-center ${
                pwMsg.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'
              }`}>
                {pwMsg.type === 'success' && <Check className="w-4 h-4 mr-1" />}
                {pwMsg.text}
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isNepali ? 'हालको पासवर्ड' : 'Current Password'} *
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
                {isNepali ? 'नयाँ पासवर्ड' : 'New Password'} *
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
                {isNepali ? 'पासवर्ड पुष्टि' : 'Confirm Password'} *
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
                  {isNepali ? 'पासवर्ड मिलेन' : 'Passwords do not match'}
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
                  {isNepali ? 'पासवर्ड परिवर्तन गर्नुहोस्' : 'Change Password'}
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
                  {isNepali ? 'प्राथमिकताहरू' : 'Preferences'}
                </h2>
              </div>

              {/* Language */}
              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{isNepali ? 'भाषा' : 'Language'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{isNepali ? 'नेपाली' : 'English'}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              {/* Notifications */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{isNepali ? 'सूचनाहरू' : 'Notifications'}</span>
                </div>
                <button
                  onClick={handleNotificationToggle}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    notifications ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                      notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Account */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-bold text-gray-700 text-sm uppercase">
                  {isNepali ? 'खाता' : 'Account'}
                </h2>
              </div>

              <button
                onClick={() => setActiveSection('editProfile')}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{isNepali ? 'प्रोफाइल सम्पादन' : 'Edit Profile'}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={() => setActiveSection('changePassword')}
                className="w-full flex items-center justify-between px-4 py-4 border-t hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800">{isNepali ? 'पासवर्ड परिवर्तन' : 'Change Password'}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* User Management - Admin Only */}
            {isAdmin && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase">
                    {isNepali ? 'प्रयोगकर्ता व्यवस्थापन' : 'User Management'}
                  </h2>
                  <button
                    onClick={() => setShowUserForm(!showUserForm)}
                    className="flex items-center gap-1 text-blue-600 text-sm font-medium"
                  >
                    {showUserForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showUserForm ? (isNepali ? 'बन्द' : 'Close') : (isNepali ? 'नयाँ' : 'Add')}
                  </button>
                </div>

                {/* Add User Form */}
                {showUserForm && (
                  <div className="p-4 border-b bg-blue-50">
                    <h3 className="font-bold text-gray-800 mb-3">
                      {isNepali ? 'नयाँ प्रयोगकर्ता थप्नुहोस्' : 'Add New User'}
                    </h3>

                    {userError && (
                      <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
                        {userError}
                      </div>
                    )}
                    {userSuccess && (
                      <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg mb-3 text-sm flex items-center">
                        <Check className="w-4 h-4 mr-1" />
                        {userSuccess}
                      </div>
                    )}

                    <form onSubmit={handleCreateUser} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isNepali ? 'प्रयोगकर्ता नाम' : 'Username'} *
                        </label>
                        <input
                          type="text"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder={isNepali ? 'प्रयोगकर्ता नाम' : 'Username'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isNepali ? 'पासवर्ड' : 'Password'} *
                        </label>
                        <div className="relative">
                          <input
                            type={showNewUserPw ? 'text' : 'password'}
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                            placeholder={isNepali ? 'पासवर्ड' : 'Password'}
                          />
                          <button type="button" className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowNewUserPw(!showNewUserPw)}>
                            {showNewUserPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isNepali ? 'पासवर्ड पुष्टि गर्नुहोस्' : 'Confirm Password'} *
                        </label>
                        <div className="relative">
                          <input
                            type={showNewUserPwConfirm ? 'text' : 'password'}
                            value={newUserPasswordConfirm}
                            onChange={(e) => setNewUserPasswordConfirm(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                            placeholder={isNepali ? 'पासवर्ड दोहोर्याउनुहोस्' : 'Repeat password'}
                          />
                          <button type="button" className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowNewUserPwConfirm(!showNewUserPwConfirm)}>
                            {showNewUserPwConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isNepali ? 'पूरा नाम' : 'Full Name'}
                        </label>
                        <input
                          type="text"
                          value={newUser.fullName}
                          onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder={isNepali ? 'पूरा नाम' : 'Full name'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isNepali ? 'भूमिका' : 'Role'} *
                        </label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          <option value="STAFF">{isNepali ? 'कर्मचारी (बिक्री मात्र)' : 'Staff (Sales only)'}</option>
                          <option value="DAD">{isNepali ? 'बुबा (पूर्ण पहुँच)' : 'Dad (Full access)'}</option>
                          <option value="SON">{isNepali ? 'छोरा (समीक्षा/स्वीकृति)' : 'Son (Review/Approve)'}</option>
                          <option value="ADMIN">{isNepali ? 'एडमिन (सबै पहुँच)' : 'Admin (All access)'}</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                          submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {submitting
                          ? (isNepali ? 'सिर्जना हुँदैछ...' : 'Creating...')
                          : (isNepali ? 'प्रयोगकर्ता सिर्जना गर्नुहोस्' : 'Create User')}
                      </button>
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
                    {isNepali ? 'कुनै प्रयोगकर्ता छैन' : 'No users found'}
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
                  {isNepali ? 'सहयोग' : 'Support'}
                </h2>
              </div>

              <div className="px-4 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <HelpCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-800 font-medium">{isNepali ? 'मद्दत' : 'Help & Support'}</span>
                </div>
                <p className="text-sm text-gray-500 ml-8">
                  {isNepali ? 'समस्या भएमा निशालाई सम्पर्क गर्नुहोस्' : 'Contact Nisha for any issues'}
                </p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full bg-white rounded-xl shadow-sm px-4 py-4 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-bold">{isNepali ? 'लग आउट' : 'Logout'}</span>
            </button>

            {/* App Version */}
            <div className="text-center text-gray-400 text-sm py-4">
              <p>Samjhana Ventures OS</p>
              <p>v1.0.0</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
