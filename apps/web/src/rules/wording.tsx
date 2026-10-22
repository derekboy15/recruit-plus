import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Which version of rules text to show: our plain English (the default) or the official wording. */
export type Wording = 'plain' | 'official';
export const WORDING_KEY = 'recruit.wording';

function readWording(): Wording {
  try {
    return localStorage.getItem(WORDING_KEY) === 'official' ? 'official' : 'plain';
  } catch {
    return 'plain'; // storage blocked (private mode, site data off)
  }
}

interface WordingApi {
  wording: Wording;
  setWording(w: Wording): void;
}

const WordingContext = createContext<WordingApi | null>(null);

/** The remembered wording choice, shared by every switch and rules text in the app. */
export function WordingProvider({ children, initial }: { children: ReactNode; initial?: Wording }) {
  const [wording, setState] = useState<Wording>(() => initial ?? readWording());
  const setWording = useCallback((w: Wording) => {
    setState(w);
    try {
      localStorage.setItem(WORDING_KEY, w);
    } catch {
      // Not remembered this time; the choice still applies until the page reloads.
    }
  }, []);
  const value = useMemo(() => ({ wording, setWording }), [wording, setWording]);
  return <WordingContext.Provider value={value}>{children}</WordingContext.Provider>;
}

export function useWording(): WordingApi {
  const ctx = useContext(WordingContext);
  if (!ctx) throw new Error('useWording must be used inside <WordingProvider>');
  return ctx;
}

const OPTIONS: [Wording, string][] = [
  ['plain', 'Plain English'],
  ['official', 'Official wording'],
];

/** Two-button switch between plain English and the official wording. */
export function WordingToggle() {
  const { wording, setWording } = useWording();
  return (
    <div className="seg" role="group" aria-label="Rules wording">
      {OPTIONS.map(([value, label]) => (
        <button key={value} type="button" className="seg__btn" aria-pressed={wording === value} onClick={() => setWording(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}
