import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { PlaySheet } from './PlayArmyView';

const opened = (state: unknown) => (state as { playSheet?: boolean } | null)?.playSheet === true;

const toParams = (s: PlaySheet): Record<string, string> => (s.kind === 'unit' ? { unit: s.selId } : { sheet: s.kind });

/**
 * The open Play mode sheet, kept in the URL (`?sheet=rules`, `?sheet=stratagems`, `?unit=<selId>`) so a phone's Back
 * button closes it. Opening a sheet adds one history entry; moving to another (Next, Previous) replaces it; closing goes
 * back past it. A sheet the page was opened with (a shared link) closes by clearing the URL instead.
 * Given the army's units (once loaded), a link to a unit it doesn't have opens nothing and is cleared from the URL.
 */
export function usePlaySheetParam(units?: { selId: string }[]): [PlaySheet | null, (next: PlaySheet | null) => void] {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const unit = params.get('unit');
  const sheet = params.get('sheet');
  const open = useMemo<PlaySheet | null>(
    () => (unit ? { kind: 'unit', selId: unit } : sheet === 'rules' || sheet === 'stratagems' ? { kind: sheet } : null),
    [unit, sheet],
  );
  const inApp = opened(location.state);
  const set = useCallback(
    (next: PlaySheet | null) => {
      if (next === null) {
        if (!open) return;
        if (inApp) navigate(-1);
        else setParams({}, { replace: true });
      } else if (open) setParams(toParams(next), { replace: true, state: location.state });
      else setParams(toParams(next), { state: { playSheet: true } });
    },
    [open, inApp, navigate, setParams, location.state],
  );
  const stale = open?.kind === 'unit' && units !== undefined && !units.some((u) => u.selId === open.selId);
  useEffect(() => {
    if (stale) set(null);
  }, [stale, set]);
  return [stale ? null : open, set];
}
