import { useEffect, useRef, useState } from 'react';

export function usePolling(callback: () => void, intervalMs: number = 30000, enabled: boolean = true) {
  const savedCallback = useRef(callback);
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!enabled || !visible) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled, visible]);
}
