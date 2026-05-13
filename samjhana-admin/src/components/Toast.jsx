import React, { useEffect, useState } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

const CONFIG = {
  success: {
    icon: Check,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    bar: 'bg-green-500',
    border: 'border-l-green-500',
  },
  error: {
    icon: AlertCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    bar: 'bg-red-500',
    border: 'border-l-red-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    bar: 'bg-blue-500',
    border: 'border-l-blue-500',
  },
};

function ToastItem({ toast, onRemove }) {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 2000;
  const cfg = CONFIG[toast.type] || CONFIG.info;
  const Icon = cfg.icon;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
    }, 16);
    const timer = setTimeout(() => onRemove(toast.id), duration);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [toast.id]);

  return (
    <div
      className={`
        relative flex items-center gap-3
        bg-white rounded-xl shadow-xl
        border border-gray-100 border-l-4 ${cfg.border}
        px-4 py-3
        min-w-[280px] max-w-[calc(100vw-32px)]
        overflow-hidden
        animate-slide-up
      `}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
      </div>

      {/* Message */}
      <p className="flex-1 text-sm font-medium text-gray-800 leading-snug pr-1">
        {toast.message}
      </p>

      {/* Close */}
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${cfg.bar} transition-none`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-24 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto w-full flex justify-center">
          <ToastItem toast={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
