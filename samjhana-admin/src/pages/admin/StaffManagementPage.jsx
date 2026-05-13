import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Phone,
  MapPin,
  Briefcase,
  DollarSign,
  Calendar,
  Edit2,
  Trash2,
  X,
  Check,
  Search,
  Filter,
  ShieldOff
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/SearchableSelect';

const BUSINESS_UNITS = [
  { value: 'PETROL', labelEn: 'Petrol Pump', labelNe: 'पेट्रोल पम्प' },
  { value: 'FURNITURE', labelEn: 'Furniture', labelNe: 'फर्निचर' },
  { value: 'EV', labelEn: 'EV Station', labelNe: 'EV स्टेशन' },
  { value: 'RENTAL', labelEn: 'Rental', labelNe: 'भाडा' },
  { value: 'ALL', labelEn: 'All Units', labelNe: 'सबै' },
];

const STAFF_ROLES = [
  { value: 'MANAGER',         labelEn: 'Manager',         labelNe: 'म्यानेजर' },
  { value: 'OPERATOR',        labelEn: 'Operator',        labelNe: 'अपरेटर' },
  { value: 'FURNITURE_STAFF', labelEn: 'Furniture Staff', labelNe: 'फर्निचर कर्मचारी' },
  { value: 'DRIVER',          labelEn: 'Driver',          labelNe: 'चालक' },
];

export default function StaffManagementPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  // Access control
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm">
          <ShieldOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {t('staff.accessDenied')}
          </h1>
          <p className="text-gray-500 mb-4">
            {t('staff.noPermission')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700"
          >
            {t('common.goBack')}
          </button>
        </div>
      </div>
    );
  }

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [filterUnit, setFilterUnit] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    fullNameNepali: '',
    phoneNumber: '',
    address: '',
    addressNepali: '',
    businessUnit: 'PETROL',
    staffRole: 'OPERATOR',
    monthlySalary: '',
    joinDate: new Date().toISOString().split('T')[0],
    emergencyContact: '',
    emergencyContactName: '',
    citizenshipNumber: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [filterUnit]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const url = filterUnit ? `/api/staff?businessUnit=${filterUnit}` : '/api/staff';
      const res = await api.get(url);
      setStaffList(res.data);
    } catch (err) {
      console.error('Failed to fetch staff', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      fullNameNepali: '',
      phoneNumber: '',
      address: '',
      addressNepali: '',
      businessUnit: 'PETROL',
      staffRole: 'OPERATOR',
      monthlySalary: '',
      joinDate: new Date().toISOString().split('T')[0],
      emergencyContact: '',
      emergencyContactName: '',
      citizenshipNumber: '',
      notes: '',
    });
    setEditingStaff(null);
    setFormError('');
    setFormSuccess('');
  };

  const openEditForm = (staff) => {
    setFormData({
      fullName: staff.fullName || '',
      fullNameNepali: staff.fullNameNepali || '',
      phoneNumber: staff.phoneNumber || '',
      address: staff.address || '',
      addressNepali: staff.addressNepali || '',
      businessUnit: staff.businessUnit || 'PETROL',
      staffRole: staff.staffRole || 'HELPER',
      monthlySalary: staff.monthlySalary || '',
      joinDate: staff.joinDate || '',
      emergencyContact: staff.emergencyContact || '',
      emergencyContactName: staff.emergencyContactName || '',
      citizenshipNumber: staff.citizenshipNumber || '',
      notes: staff.notes || '',
    });
    setEditingStaff(staff);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.fullName.trim()) {
      setFormError(t('staff.fullNameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        monthlySalary: formData.monthlySalary ? parseFloat(formData.monthlySalary) : null,
      };

      if (editingStaff) {
        await api.put(`/api/staff/${editingStaff.id}`, payload);
        setFormSuccess(t('staff.staffUpdated'));
      } else {
        await api.post('/api/staff', payload);
        setFormSuccess(t('staff.staffAdded'));
      }

      fetchStaff();
      setTimeout(() => {
        setShowForm(false);
        resetForm();
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (staff) => {
    if (!confirm(`${t('staff.removeConfirm')} ${staff.fullName}?`)) return;

    try {
      await api.delete(`/api/staff/${staff.id}`);
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    }
  };

  const getUnitLabel = (unit) => {
    const found = BUSINESS_UNITS.find(u => u.value === unit);
    return found ? (isNepali ? found.labelNe : found.labelEn) : unit;
  };

  const getRoleLabel = (role) => {
    const found = STAFF_ROLES.find(r => r.value === role);
    return found ? (isNepali ? found.labelNe : found.labelEn) : role;
  };

  const getUnitColor = (unit) => {
    const colors = {
      PETROL: 'bg-orange-100 text-orange-700',
      FURNITURE: 'bg-purple-100 text-purple-700',
      EV: 'bg-green-100 text-green-700',
      RENTAL: 'bg-blue-100 text-blue-700',
      ALL: 'bg-gray-100 text-gray-700',
    };
    return colors[unit] || 'bg-gray-100 text-gray-700';
  };

  const filteredStaff = staffList.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.fullName?.toLowerCase().includes(search) ||
      s.fullNameNepali?.includes(searchTerm) ||
      s.phoneNumber?.includes(search)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(isNepali ? 'ne-NP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSalary = (amount) => {
    if (!amount) return '-';
    return `रु ${parseFloat(amount).toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Users className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('staff.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Actions Bar */}
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between gap-3">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700"
        >
          <UserPlus className="w-5 h-5" />
          {t('staff.addStaff')}
        </button>

        <SearchableSelect
          value={filterUnit}
          onChange={(val) => setFilterUnit(val)}
          options={BUSINESS_UNITS.map(unit => ({
            value: unit.value,
            label: isNepali ? unit.labelNe : unit.labelEn,
          }))}
          placeholder={t('staff.allUnits')}
          accentColor="indigo"
          className="py-2 text-base"
        />
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('staff.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editingStaff
                  ? t('staff.editStaff')
                  : t('staff.addNewStaff')}
              </h2>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center">
                  <Check className="w-4 h-4 mr-1" />
                  {formSuccess}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.fullName')} *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder={t('staff.fullNamePlaceholder')}
                />
              </div>

              {/* Full Name Nepali */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.nameNepali')}
                </label>
                <input
                  type="text"
                  value={formData.fullNameNepali}
                  onChange={(e) => setFormData({ ...formData, fullNameNepali: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="नेपालीमा नाम"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.phone')}
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="98XXXXXXXX"
                />
              </div>

              {/* Business Unit & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.businessUnit')} *
                  </label>
                  <SearchableSelect
                    value={formData.businessUnit}
                    onChange={(val) => setFormData({ ...formData, businessUnit: val })}
                    options={BUSINESS_UNITS.map(unit => ({
                      value: unit.value,
                      label: isNepali ? unit.labelNe : unit.labelEn,
                    }))}
                    accentColor="indigo"
                    className="py-2 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.role')} *
                  </label>
                  <SearchableSelect
                    value={formData.staffRole}
                    onChange={(val) => setFormData({ ...formData, staffRole: val })}
                    options={STAFF_ROLES.map(role => ({
                      value: role.value,
                      label: isNepali ? role.labelNe : role.labelEn,
                    }))}
                    accentColor="indigo"
                    className="py-2 text-base"
                  />
                </div>
              </div>

              {/* Salary & Join Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.monthlySalary')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">रु</span>
                    <input
                      type="number"
                      value={formData.monthlySalary}
                      onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.joinDate')}
                  </label>
                  <DatePicker
                    value={formData.joinDate}
                    onChange={(val) => setFormData({ ...formData, joinDate: val })}
                    accentColor="indigo"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.address')}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder={t('staff.address')}
                />
              </div>

              {/* Citizenship */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.citizenship')}
                </label>
                <input
                  type="text"
                  value={formData.citizenshipNumber}
                  onChange={(e) => setFormData({ ...formData, citizenshipNumber: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder={t('staff.citizenshipPlaceholder')}
                />
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.emergencyContact')}
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                    placeholder="98XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.contactName')}
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                    placeholder={t('common.name')}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.notes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder={t('common.additionalNotes')}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                  submitting ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitting
                  ? t('staff.saving')
                  : editingStaff
                    ? t('staff.updateStaff')
                    : t('staff.addStaff')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t('staff.noStaff')}</p>
          <p className="text-sm mt-1">{t('staff.addFirstStaff')}</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filteredStaff.map((staff) => (
            <div
              key={staff.id}
              className="bg-white rounded-xl shadow-sm p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{staff.fullName}</h3>
                    {staff.fullNameNepali && (
                      <span className="text-sm text-gray-500">({staff.fullNameNepali})</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getUnitColor(staff.businessUnit)}`}>
                      {getUnitLabel(staff.businessUnit)}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {getRoleLabel(staff.staffRole)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                    {staff.phoneNumber && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {staff.phoneNumber}
                      </div>
                    )}
                    {staff.monthlySalary && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatSalary(staff.monthlySalary)}
                      </div>
                    )}
                    {staff.joinDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(staff.joinDate)}
                      </div>
                    )}
                    {staff.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {staff.address}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => openEditForm(staff)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(staff)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
