import React, { useState, useCallback } from 'react';
import { Camera, Calendar, ChevronDown, X, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNepaliNumber, formatCurrency } from '../utils/formatters';

/**
 * DynamicFormBuilder - Renders forms based on field templates from the backend.
 * 
 * This is the core of the "Dad-Proof" UI - it takes a template and renders
 * large, accessible form fields optimized for elderly users and mobile devices.
 * 
 * Features:
 * - Large touch targets (min 48px)
 * - Clear Nepali labels
 * - Big number keypads for numeric fields
 * - Camera integration for invoice photos
 * - Validation feedback in real-time
 */

// Field type renderers
const FieldRenderers = {
  TEXT: TextInput,
  NUMBER: NumberInput,
  DECIMAL: DecimalInput,
  CURRENCY: CurrencyInput,
  DATE: DateInput,
  ENUM: SelectInput,
  CAMERA: CameraInput,
  BOOLEAN: ToggleInput,
  TEXTAREA: TextAreaInput,
  PHONE: PhoneInput,
  CALCULATED: CalculatedField,
};

export default function DynamicFormBuilder({
  template,          // Array of field definitions from backend
  values,            // Current form values
  onChange,          // Callback when values change
  onSubmit,          // Callback when form is submitted
  errors = {},       // Validation errors { fieldKey: errorMessage }
  isLoading = false, // Show loading state
  submitLabel,       // Custom submit button label
  businessCode,      // Current business code for context
}) {
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  // Handle field value change
  const handleFieldChange = useCallback((fieldKey, value) => {
    onChange({
      ...values,
      [fieldKey]: value,
    });
  }, [values, onChange]);

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  // Get label based on locale
  const getLabel = (field) => {
    return isNepali && field.labelNe ? field.labelNe : field.labelEn;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      {/* Form Fields */}
      {template
        .filter(field => field.isActive !== false)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map((field) => {
          const Renderer = FieldRenderers[field.fieldType] || TextInput;
          const error = errors[field.fieldKey];
          const value = values[field.fieldKey];

          return (
            <div key={field.fieldKey} className="form-field">
              {/* Label */}
              <label 
                htmlFor={field.fieldKey}
                className="block text-lg font-medium text-gray-700 mb-2"
              >
                {getLabel(field)}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>

              {/* Field Renderer */}
              <Renderer
                field={field}
                value={value}
                onChange={(val) => handleFieldChange(field.fieldKey, val)}
                error={error}
                isNepali={isNepali}
              />

              {/* Error Message */}
              {error && (
                <div className="flex items-center mt-2 text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Hint/Placeholder */}
              {field.placeholder && !error && (
                <p className="mt-1 text-sm text-gray-500">{field.placeholder}</p>
              )}
            </div>
          );
        })}

      {/* Submit Button - Extra Large for Dad */}
      <button
        type="submit"
        disabled={isLoading}
        className={`
          w-full py-5 px-6 text-xl font-bold rounded-xl
          transition-all duration-200 transform
          ${isLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-lg hover:shadow-xl'
          }
          text-white
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            {t('common.saving')}
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <Check className="w-6 h-6 mr-2" />
            {submitLabel || t('common.save')}
          </span>
        )}
      </button>
    </form>
  );
}

// =============================================================================
// FIELD RENDERERS - Each optimized for touch and accessibility
// =============================================================================

function TextInput({ field, value, onChange, error }) {
  return (
    <input
      type="text"
      id={field.fieldKey}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full px-4 py-4 text-xl border-2 rounded-xl
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-500' : 'border-gray-300'}
      `}
      placeholder={field.placeholder}
      required={field.isRequired}
    />
  );
}

function NumberInput({ field, value, onChange, error, isNepali }) {
  const [showKeypad, setShowKeypad] = useState(false);

  const handleKeypadPress = (digit) => {
    const currentValue = value?.toString() || '';
    if (digit === 'backspace') {
      onChange(currentValue.slice(0, -1));
    } else if (digit === 'clear') {
      onChange('');
    } else {
      onChange(currentValue + digit);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        id={field.fieldKey}
        value={isNepali ? formatNepaliNumber(value) : value || ''}
        onFocus={() => setShowKeypad(true)}
        readOnly
        className={`
          w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
        placeholder="०"
      />
      
      {/* Large Number Keypad for Dad */}
      {showKeypad && (
        <div className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-gray-200 p-4 z-50 shadow-lg">
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'backspace' || key === 'clear') {
                    handleKeypadPress(key);
                  } else {
                    handleKeypadPress(key);
                  }
                }}
                className={`
                  py-5 text-2xl font-bold rounded-xl
                  ${key === 'clear' ? 'bg-red-100 text-red-600' : ''}
                  ${key === 'backspace' ? 'bg-yellow-100 text-yellow-700' : ''}
                  ${!['clear', 'backspace'].includes(key) ? 'bg-gray-100 hover:bg-gray-200' : ''}
                  active:scale-95 transition-transform
                `}
              >
                {key === 'backspace' ? '⌫' : key === 'clear' ? 'C' : isNepali ? formatNepaliNumber(key) : key}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowKeypad(false)}
            className="w-full mt-4 py-4 bg-green-600 text-white text-xl font-bold rounded-xl"
          >
            ✓ Done
          </button>
        </div>
      )}
    </div>
  );
}

function DecimalInput({ field, value, onChange, error }) {
  return (
    <input
      type="number"
      step="0.01"
      id={field.fieldKey}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full px-4 py-4 text-xl border-2 rounded-xl
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-500' : 'border-gray-300'}
      `}
      inputMode="decimal"
      required={field.isRequired}
    />
  );
}

function CurrencyInput({ field, value, onChange, error, isNepali }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">
        रु
      </span>
      <input
        type="text"
        inputMode="numeric"
        id={field.fieldKey}
        value={value ? formatCurrency(value, false) : ''}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          onChange(raw);
        }}
        className={`
          w-full pl-12 pr-4 py-4 text-xl border-2 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
        required={field.isRequired}
      />
    </div>
  );
}

function DateInput({ field, value, onChange, error }) {
  return (
    <div className="relative">
      <input
        type="date"
        id={field.fieldKey}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full px-4 py-4 text-xl border-2 rounded-xl
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
        required={field.isRequired}
      />
      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function SelectInput({ field, value, onChange, error, isNepali }) {
  const options = field.options ? JSON.parse(field.options) : [];

  return (
    <div className="relative">
      <select
        id={field.fieldKey}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full px-4 py-4 text-xl border-2 rounded-xl appearance-none
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
        required={field.isRequired}
      >
        <option value="">-- {isNepali ? 'छान्नुहोस्' : 'Select'} --</option>
        {options.map((opt) => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function CameraInput({ field, value, onChange, error }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(value);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result);
        onChange(file);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-3">
      {/* Camera Capture Button - Extra Large */}
      <label
        htmlFor={field.fieldKey}
        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <Camera className="w-16 h-16 text-gray-400 mb-2" />
        <span className="text-lg text-gray-500">
          {t('common.takePhoto')}
        </span>
        <input
          type="file"
          id={field.fieldKey}
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
        />
      </label>

      {/* Preview */}
      {preview && (
        <div className="relative">
          <img 
            src={preview} 
            alt="Captured" 
            className="w-full h-48 object-cover rounded-xl"
          />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleInput({ field, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`
        relative w-20 h-12 rounded-full transition-colors
        ${value ? 'bg-green-500' : 'bg-gray-300'}
      `}
    >
      <span
        className={`
          absolute top-1 w-10 h-10 bg-white rounded-full shadow transition-transform
          ${value ? 'left-9' : 'left-1'}
        `}
      />
    </button>
  );
}

function TextAreaInput({ field, value, onChange, error }) {
  return (
    <textarea
      id={field.fieldKey}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className={`
        w-full px-4 py-4 text-lg border-2 rounded-xl resize-none
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-500' : 'border-gray-300'}
      `}
      placeholder={field.placeholder}
      required={field.isRequired}
    />
  );
}

function PhoneInput({ field, value, onChange, error }) {
  return (
    <input
      type="tel"
      id={field.fieldKey}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full px-4 py-4 text-xl border-2 rounded-xl
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${error ? 'border-red-500' : 'border-gray-300'}
      `}
      inputMode="tel"
      pattern="[0-9]{10}"
      placeholder="98XXXXXXXX"
      required={field.isRequired}
    />
  );
}

function CalculatedField({ field, value, isNepali }) {
  return (
    <div className="px-4 py-4 text-2xl font-bold text-center bg-gray-100 rounded-xl text-gray-700">
      {isNepali ? formatNepaliNumber(value) : value || '—'}
    </div>
  );
}
