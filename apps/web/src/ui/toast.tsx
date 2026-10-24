import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './icons';

export interface ToastInput {
  message: string;
  /** Usually Undo: runs once, then the toast goes. */
  action?: { label: string; onAction: () => void };
  /** Default 6000. */
  durationMs?: number;
}

const DEFAULT_MS = 6000;
const ToastContext = createContext<{ show(t: ToastInput): void } | null>(null);

/**
 * One toast at a time, above the tab bar: a new one replaces the current one, and the replaced one's action can no
 * longer run. It stays while focus is inside it, so a keyboard user who reaches Undo doesn't lose it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const seq = useRef(0);
  /** The showing toast's id, or 0: an action or timer for any other id does nothing. */
  const current = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focused = useRef(false);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    current.current = 0;
    focused.current = false;
    setToast(null);
  }, []);
  const startTimer = useCallback(
    (id: number, ms: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (current.current === id && !focused.current) dismiss();
      }, ms);
    },
    [dismiss],
  );
  const show = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      current.current = id;
      focused.current = false;
      setToast({ ...t, id });
      startTimer(id, t.durationMs ?? DEFAULT_MS);
    },
    [startTimer],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Always in the page so screen readers hear new toasts; a status only while one shows, so an empty region is
          never a second "status" beside the page's own messages. */}
      <div role={toast ? 'status' : undefined} aria-live="polite" aria-atomic="true" className="toast-region">
        {toast && (
          <div
            key={toast.id}
            className="toast"
            onFocus={() => (focused.current = true)}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              focused.current = false;
              startTimer(toast.id, toast.durationMs ?? DEFAULT_MS);
            }}
          >
            <p className="toast__message">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                className="btn btn--tertiary toast__action"
                onClick={() => {
                  if (current.current !== toast.id) return;
                  dismiss();
                  toast.action!.onAction();
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="btn btn--icon toast__close" aria-label="Dismiss" onClick={dismiss}>
              <IconClose size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): { show(t: ToastInput): void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast needs a ToastProvider');
  return ctx;
}
