import { useEffect, useRef, type ReactNode } from 'react';

// Open modals, innermost last, so Escape only closes the top one.
const stack: object[] = [];

export function Modal({ onClose, label, children, maxWidth = 440, z = 30 }: { onClose: () => void; label: string; children: ReactNode; maxWidth?: number; z?: number }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const me = {};
    stack.push(me);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && stack[stack.length - 1] === me) close.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); stack.splice(stack.indexOf(me), 1); };
  }, []);
  return (
    <div className="backdrop" style={{ zIndex: z }} onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
