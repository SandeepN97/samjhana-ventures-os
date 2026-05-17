import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Zap,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Car,
  Battery,
  Users,
  ShieldOff
} from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../../components/LanguageToggle';

export default function EvVehiclePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm">
          <ShieldOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {t('evVehicle.accessDenied')}
          </h1>
          <p className="text-gray-500 mb-4">
            {t('evVehicle.noPermission')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700"
          >
            {t('common.goBack')}
          </button>
        </div>
      </div>
    );
  }

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  const [formData, setFormData] = useState({
    vehicleName: '',
    batteryCapacityKw: '',
    seatingCapacity: '',
    ratePerPercent: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ev-vehicles/all');
      setVehicles(res.data);
    } catch (err) {
      console.error('Failed to fetch vehicles', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleName: '',
      batteryCapacityKw: '',
      seatingCapacity: '',
      ratePerPercent: '',
    });
    setEditingVehicle(null);
    setFormError('');
    setFormSuccess('');
  };

  const openEditForm = (vehicle) => {
    setFormData({
      vehicleName: vehicle.vehicleName || '',
      batteryCapacityKw: vehicle.batteryCapacityKw || '',
      seatingCapacity: vehicle.seatingCapacity || '',
      ratePerPercent: vehicle.ratePerPercent || '',
    });
    setEditingVehicle(vehicle);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.vehicleName.trim()) {
      setFormError(t('evVehicle.vehicleNameRequired'));
      return;
    }
    if (!formData.ratePerPercent || parseFloat(formData.ratePerPercent) <= 0) {
      setFormError(t('evVehicle.rateRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicleName: formData.vehicleName.trim(),
        batteryCapacityKw: formData.batteryCapacityKw ? parseFloat(formData.batteryCapacityKw) : null,
        seatingCapacity: formData.seatingCapacity ? parseInt(formData.seatingCapacity) : null,
        ratePerPercent: parseFloat(formData.ratePerPercent),
      };

      if (editingVehicle) {
        await api.put(`/api/ev-vehicles/${editingVehicle.id}`, payload);
        setFormSuccess(t('evVehicle.vehicleUpdated'));
      } else {
        await api.post('/api/ev-vehicles', payload);
        setFormSuccess(t('evVehicle.vehicleAdded'));
      }

      fetchVehicles();
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

  const handleDelete = async (vehicle) => {
    if (!confirm(`${t('evVehicle.removeConfirm')} ${vehicle.vehicleName}?`)) return;

    try {
      await api.delete(`/api/ev-vehicles/${vehicle.id}`);
      fetchVehicles();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-green-500 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/entry/ev')}
              className="p-2 -ml-2 rounded-full hover:bg-green-600 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Car className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('evVehicle.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Actions Bar */}
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          {t('evVehicle.addVehicle')}
        </button>
        <span className="text-sm text-gray-500">
          {vehicles.filter(v => v.isActive).length} {t('evVehicle.active')}
        </span>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editingVehicle
                  ? t('evVehicle.editVehicle')
                  : t('evVehicle.addNewVehicle')}
              </h2>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

              {/* Vehicle Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('evVehicle.vehicleName')} *
                </label>
                <input
                  type="text"
                  value={formData.vehicleName}
                  onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder="e.g. Higer (100KW)"
                />
              </div>

              {/* Battery & Seats */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evVehicle.battery')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.batteryCapacityKw}
                    onChange={(e) => setFormData({ ...formData, batteryCapacityKw: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="50.23"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('evVehicle.seats')}
                  </label>
                  <input
                    type="number"
                    value={formData.seatingCapacity}
                    onChange={(e) => setFormData({ ...formData, seatingCapacity: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="16"
                  />
                </div>
              </div>

              {/* Rate per Percent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('evVehicle.ratePerPercent')} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">रु</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ratePerPercent}
                    onChange={(e) => setFormData({ ...formData, ratePerPercent: e.target.value })}
                    className="w-full pl-10 pr-12 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">/%</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                  submitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {submitting
                  ? t('evVehicle.saving')
                  : editingVehicle
                    ? t('evVehicle.updateVehicle')
                    : t('evVehicle.addVehicle')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Car className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t('evVehicle.noVehicles')}</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className={`bg-white rounded-xl shadow-sm p-4 ${!vehicle.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{vehicle.vehicleName}</h3>
                    {!vehicle.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {t('evVehicle.inactive')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Battery className="w-4 h-4 text-green-500" />
                      {vehicle.batteryCapacityKw} KW
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-blue-500" />
                      {vehicle.seatingCapacity} {t('evVehicle.seatsLabel')}
                    </div>
                    <div className="flex items-center gap-1 font-bold text-green-700">
                      <Zap className="w-4 h-4" />
                      रु {vehicle.ratePerPercent}/%
                    </div>
                  </div>
                </div>

                {vehicle.isActive && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditForm(vehicle)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
