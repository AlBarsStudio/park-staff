import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useIsMobile } from '../../hooks/useMediaQuery';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ 
  id, 
  type, 
  message, 
  duration = 3000, 
  onClose 
}) => {
  const isMobile = useIsMobile();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[type];

  const variants = {
    success: {
      bg: 'var(--success-light)',
      border: 'var(--success)',
      icon: 'var(--success)',
    },
    error: {
      bg: 'var(--error-light)',
      border: 'var(--error)',
      icon: 'var(--error)',
    },
    warning: {
      bg: 'var(--warning-light)',
      border: 'var(--warning)',
      icon: 'var(--warning)',
    },
    info: {
      bg: 'var(--info-light)',
      border: 'var(--info)',
      icon: 'var(--info)',
    },
  };

  const variant = variants[type];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border-2 shadow-lg transition-all duration-300',
        isMobile ? 'p-3 min-w-[280px] max-w-[calc(100vw-2rem)]' : 'p-4 min-w-[320px] max-w-md',
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
      style={{
        backgroundColor: variant.bg,
        borderColor: variant.border,
      }}
    >
      <Icon 
        className={cn('flex-shrink-0', isMobile ? 'h-5 w-5' : 'h-6 w-6')}
        style={{ color: variant.icon }}
      />
      
      <p 
        className={cn('flex-1 font-medium', isMobile ? 'text-sm' : 'text-base')}
        style={{ color: 'var(--text)' }}
      >
        {message}
      </p>

      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-lg transition-all active:scale-90"
        style={{ color: variant.icon }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Закрыть"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
  }>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  toasts, 
  onClose 
}) => {
  const isMobile = useIsMobile();

  if (toasts.length === 0) return null;

  const container = (
    <div
      className={cn(
        'fixed z-[9999] flex flex-col gap-3',
        isMobile
          ? 'top-4 left-4 right-4'
          : 'top-6 right-6'
      )}
      style={{
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast {...toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );

  return createPortal(container, document.body);
};

// Hook для использования Toast
export const useToast = () => {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
  }>>([]);

  const addToast = (type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const toast = {
    success: (message: string, duration?: number) => addToast('success', message, duration),
    error: (message: string, duration?: number) => addToast('error', message, duration),
    warning: (message: string, duration?: number) => addToast('warning', message, duration),
    info: (message: string, duration?: number) => addToast('info', message, duration),
  };

  return {
    toast,
    toasts,
    removeToast,
    ToastContainer: () => <ToastContainer toasts={toasts} onClose={removeToast} />,
  };
};

export default Toast;
