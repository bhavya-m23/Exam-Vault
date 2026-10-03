import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

export const NotificationToast = () => {
  const { toast, clearToast } = useAuth();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle className="text-emerald-400 shrink-0" size={20} />;
      case 'danger': return <AlertOctagon className="text-red-400 shrink-0" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-400 shrink-0" size={20} />;
      default: return <Info className="text-blue-400 shrink-0" size={20} />;
    }
  };

  const getBorder = () => {
    switch (toast.type) {
      case 'success': return 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100';
      case 'danger': return 'border-red-500/40 bg-red-950/90 text-red-100';
      case 'warning': return 'border-amber-500/40 bg-amber-950/90 text-amber-100';
      default: return 'border-blue-500/40 bg-slate-900/90 text-blue-100';
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-bounce-short">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all ${getBorder()}`}>
        {getIcon()}
        <div className="flex-1 text-sm font-medium leading-relaxed">
          {toast.message}
        </div>
        <button
          onClick={clearToast}
          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
