import React, { useEffect, useRef, useState } from 'react';

const Toast: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      const msg = detail?.message || '';
      if (!msg) return;
      setMessage(msg);
      setVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
      }, 3000);
    };
    window.addEventListener('app:toast', handler as EventListener);
    return () => window.removeEventListener('app:toast', handler as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="max-w-sm bg-black/80 text-white border border-white/10 rounded-md px-4 py-3 shadow-lg">
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
};

export default Toast;
