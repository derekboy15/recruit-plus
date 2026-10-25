/**
 * The game screen's pinned action bar. Panels wrap the button that commits what the player set up (`main`) and the one
 * that moves the game on (`end`) in PinAction; inside an ActionSlotProvider (the Practice game) they render in the bar at
 * the bottom of the panel, main first, so the next step is always on screen. Without one (the Learn drills) they render
 * in place, exactly as before.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Slots = { main: HTMLElement | null; end: HTMLElement | null };
const SlotContext = createContext<Slots | null>(null);

export function ActionSlotProvider({ children }: { children: ReactNode }) {
  const [main, setMain] = useState<HTMLElement | null>(null);
  const [end, setEnd] = useState<HTMLElement | null>(null);
  const slots = useMemo(() => ({ main, end }), [main, end]);
  return (
    <SlotContext.Provider value={slots}>
      {children}
      <div className="game__actions" role="group" aria-label="Actions">
        <div className="game__actions-main" ref={setMain} />
        <div className="game__actions-end" ref={setEnd} />
      </div>
    </SlotContext.Provider>
  );
}

export function PinAction({ slot, children }: { slot: 'main' | 'end'; children: ReactNode }) {
  const slots = useContext(SlotContext);
  if (!slots) return <>{children}</>;
  const target = slots[slot];
  return target ? createPortal(children, target) : null;
}
