import { useEffect, useRef } from 'react';

const MAX_INTERVAL_MS = 50;
const MIN_LENGTH = 3;

export function useBarcodeScanner(onScan: (code: string) => void) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isTyping =
        (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) &&
        !(target as HTMLInputElement).readOnly;

      if (isTyping) return;

      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= MIN_LENGTH) {
          onScan(code);
        }
        return;
      }

      if (e.key.length !== 1) return;

      if (delta > MAX_INTERVAL_MS && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      bufferRef.current += e.key;
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}
