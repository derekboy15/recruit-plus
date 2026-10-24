import { BATTLE_SIZES, findSelView } from '@recruit/data/roster';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { factionDisplayName } from '../factions/names';
import { useAsync } from '../factions/useAsync';
import { ArmyOptions } from './ArmyOptions';
import { ArmySetup, DetachmentSection } from './Detachments';
import { EditorHeader } from './EditorHeader';
import { ExportSheet, ShareSheet } from './ExportSheet';
import { unitsWithIssues } from './editorView';
import { IssuesPanel } from './IssuesPanel';
import { loadUnitIndex } from './unitIndex';
import { UnitEditor } from './UnitEditor';
import { UnitPicker } from './UnitPicker';
import { useRosterEditor, type ReadyEditor } from './useRosterEditor';
import { LoadError } from '../layout/OfflineNotice';
import './lists.css';

const WIDE = '(min-width: 768px)';

/** Whether the screen is wide enough for the side column (768px and up). */
function useWideScreen(): boolean {
  const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE) : null);
  const [wide, setWide] = useState(() => media()?.matches ?? false);
  useEffect(() => {
    const query = media();
    if (!query) return;
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/**
 * Which panel is open lives in the URL (?unit=, ?add=&only=, ?issues=1), so the phone's back button closes it.
 * Opening from the list adds a history entry; switching panels replaces it.
 */
function usePanels() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inPanel = (location.state as { panel?: boolean } | null)?.panel === true;
  const open = useCallback(
    (next: Record<string, string>) => setParams(next, { replace: inPanel, state: { panel: true } }),
    [setParams, inPanel],
  );
  // One close per history entry: a removed unit's editor may be closed by its button and by the stale-panel check.
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
  }, [location.key]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (inPanel) navigate(-1);
    else setParams({}, { replace: true });
  }, [inPanel, navigate, setParams]);
  return { params, open, close };
}

export function ListEditorPage() {
  const { id = '' } = useParams();
  const { params, open, close } = usePanels();
  const ui = useMemo(
    () => ({
      openUnit: (selId: string) => open({ unit: selId }),
      openPicker: (forceSelId: string, entryIds: string[]) => open({ add: forceSelId, only: entryIds.join(',') }),
    }),
    [open],
  );
  const editor = useRosterEditor(id, ui);

  if (editor.status === 'loading') return <p className="muted">Loading your list…</p>;
  if (editor.status === 'missing') {
    return (
      <section>
        <h1>List not found</h1>
        <p>We couldn’t find this list on this device. It may have been deleted.</p>
        <Link to="/build" className="btn">
          Back to your lists
        </Link>
      </section>
    );
  }
  if (editor.status === 'error') return <LoadError error={editor.error} what="this list" />;
  return <Editor listId={id} editor={editor} params={params} open={open} close={close} openUnit={ui.openUnit} />;
}

interface EditorProps {
  listId: string;
  editor: ReadyEditor;
  params: URLSearchParams;
  open: (next: Record<string, string>) => void;
  close: () => void;
  openUnit: (selId: string) => void;
}

function Editor({ listId, editor, params, open, close, openUnit }: EditorProps) {
  const { roster, view, issues, scope, policy, catalogues, slugs, dispatch, flush, saveError, allyError } = editor;
  const wide = useWideScreen();
  const unitIndex = useAsync(() => loadUnitIndex(slugs), slugs.join('+'));
  const units = unitIndex.status === 'ready' ? unitIndex.data : null;
  const flagged = useMemo(() => unitsWithIssues(view, issues), [view, issues]);

  const unitParam = params.get('unit');
  const addParam = params.get('add');
  const issuesOpen = params.get('issues') === '1';
  const exportOpen = params.get('export') === '1';
  const shareOpen = params.get('share') === '1';
  const openSel = unitParam ? findSelView(view, unitParam) : undefined;
  const pickerForce = addParam ? view.forces.find((f) => f.force.id === addParam) : undefined;

  // A panel whose unit or detachment has gone (removed, or a stale link) closes itself.
  const stale = (unitParam !== null && !openSel) || (addParam !== null && !pickerForce);
  useEffect(() => {
    if (stale) close();
  }, [stale, close]);

  const catalogue = catalogues.find((c) => c.id === roster.catalogueId);
  const defaultName = `${catalogue ? factionDisplayName(catalogue.name) : 'My'} ${BATTLE_SIZES[roster.battleSize]?.name ?? 'list'}`;
  const panelProps = { scope, roster, view, issues, units, dispatch };

  // One sheet at a time over the list (a drawer from 768px); on wide screens Problems also rests beside the list.
  let sheet: ReactNode = null;
  if (openSel) sheet = <UnitEditor key={openSel.sel.id} selId={openSel.sel.id} {...panelProps} onClose={close} />;
  else if (pickerForce) {
    const only = params.get('only')?.split(',').filter(Boolean);
    const onAdd = (entryId: string) => {
      const selId = dispatch({ type: 'add-unit', forceSelId: pickerForce.force.id, entryId });
      if (selId) openUnit(selId);
    };
    sheet = <UnitPicker key={params.toString()} scope={scope} roster={roster} forceSelId={pickerForce.force.id} only={only} units={units} onAdd={onAdd} onClose={close} />;
  } else if (exportOpen) {
    sheet = <ExportSheet view={view} scope={scope} onClose={close} />;
  } else if (shareOpen) {
    sheet = <ShareSheet listId={listId} flush={flush} onClose={close} />;
  } else if (issuesOpen) {
    sheet = <IssuesPanel issues={issues} view={view} scope={scope} dispatch={dispatch} onClose={close} />;
  }
  const aside = wide && !issuesOpen ? <IssuesPanel issues={issues} view={view} scope={scope} dispatch={dispatch} inline onClose={close} /> : null;

  return (
    <div className="editor">
      <div className="editor__main">
        <EditorHeader
          view={view}
          issueCount={issues.length}
          issuesOpen={issuesOpen}
          defaultName={defaultName}
          dispatch={dispatch}
          onIssues={() => (issuesOpen ? close() : open({ issues: '1' }))}
        />
        <div className="editor-actions">
          <button type="button" className="btn" onClick={() => open({ export: '1' })}>
            Export
          </button>
          <button type="button" className="btn" onClick={() => open({ share: '1' })}>
            Share
          </button>
        </div>
        {saveError && <p role="alert">{`Couldn’t save your last change: ${saveError.message}. It will be saved with your next edit.`}</p>}
        {allyError && <p role="alert">{`Couldn’t add that detachment: ${allyError.message}`}</p>}
        {view.forces[0] && <ArmyOptions scope={scope} roster={roster} view={view} army={view.forces[0]} issues={issues} dispatch={dispatch} />}
        {view.forces.map((fv, i) => (
          <DetachmentSection
            key={fv.force.id}
            scope={scope}
            fv={fv}
            first={i === 0}
            armyCatalogueId={roster.catalogueId}
            // The army's own detachment stays while an ally needs it: the first one goes only if another of its own follows.
            canRemove={i > 0 || view.forces[1]?.force.catalogueId === roster.catalogueId}
            flagged={flagged}
            dispatch={dispatch}
            onOpenUnit={openUnit}
            onAddUnit={(forceSelId) => open({ add: forceSelId })}
          />
        ))}
        <ArmySetup scope={scope} roster={roster} policy={policy} catalogues={catalogues} dispatch={dispatch} />
      </div>
      {aside && <div className="editor__aside">{aside}</div>}
      {sheet}
    </div>
  );
}
