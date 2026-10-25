import { findSelView } from '@recruit/data/roster';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAsync } from '../factions/useAsync';
import { ArmyChoiceSheet } from './ArmyChoiceSheet';
import { MoreOptionsSheet, useChoiceTargets } from './ArmyOptions';
import { DatasheetSheet } from './DatasheetSheet';
import { DetachmentSection, useCollapsed } from './Detachments';
import { EditorHeader } from './EditorHeader';
import { ExportSheet, ShareSheet } from './ExportSheet';
import { useEditorShortcuts } from './history';
import { IssuesPanel } from './IssuesPanel';
import { AddToSheet, DetachmentSheet, SizeSheet } from './SummarySheets';
import { loadUnitIndex, unitInfo } from './unitIndex';
import { UnitEditor } from './UnitEditor';
import { UnitPicker } from './UnitPicker';
import { useEntryInfo } from './useEntryInfo';
import { useRosterEditor, type ReadyEditor } from './useRosterEditor';
import { LoadError } from '../layout/OfflineNotice';
import { IconPlus, IconShare } from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
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
        <PageHeader title="List not found" back={{ to: '/build', label: 'Your lists' }} />
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
  const { roster, view, issues, scope, slugs, dispatch, flush, saveError, allyError } = editor;
  useEditorShortcuts(editor);
  const wide = useWideScreen();
  const unitIndex = useAsync(() => loadUnitIndex(slugs), slugs.join('+'));
  const units = unitIndex.status === 'ready' ? unitIndex.data : null;
  const info = useEntryInfo(slugs);
  const choiceFor = useChoiceTargets(editor);
  const onChoose = useCallback((key: string) => open({ choice: key }), [open]);
  const [collapsed, toggleCollapsed] = useCollapsed(listId);

  const unitParam = params.get('unit');
  const addParam = params.get('add');
  const issuesOpen = params.get('issues') === '1';
  const exportOpen = params.get('export') === '1';
  const shareOpen = params.get('share') === '1';
  const sheetParam = params.get('sheet');
  const choiceParam = params.get('choice');
  const datasheetParam = params.get('datasheet');
  const openSel = unitParam ? findSelView(view, unitParam) : undefined;
  const datasheetSel = datasheetParam ? findSelView(view, datasheetParam) : undefined;
  const pickerForce = addParam ? view.forces.find((f) => f.force.id === addParam) : undefined;

  // A panel whose unit or detachment has gone (removed, or a stale link) closes itself.
  const stale = (unitParam !== null && !openSel) || (addParam !== null && !pickerForce) || (datasheetParam !== null && !datasheetSel);
  useEffect(() => {
    if (stale) close();
  }, [stale, close]);

  // One sheet at a time over the list (a drawer from 768px); on wide screens Problems also rests beside the list.
  let sheet: ReactNode = null;
  if (openSel) sheet = <UnitEditor key={openSel.sel.id} editor={editor} selId={openSel.sel.id} units={units} info={info} onClose={close} />;
  else if (pickerForce) {
    const only = params.get('only')?.split(',').filter(Boolean);
    const onAdd = (entryId: string) => {
      const selId = dispatch({ type: 'add-unit', forceSelId: pickerForce.force.id, entryId });
      if (selId) openUnit(selId);
    };
    sheet = (
      <UnitPicker
        key={params.toString()}
        scope={scope}
        roster={roster}
        forceSelId={pickerForce.force.id}
        only={only}
        role={params.get('role') ?? undefined}
        units={units}
        onAdd={onAdd}
        onClose={close}
      />
    );
  } else if (datasheetSel) {
    sheet = <DatasheetSheet v={datasheetSel} info={unitInfo(scope, units, datasheetSel.sel.entryId)} onClose={close} />;
  } else if (exportOpen) {
    sheet = <ExportSheet view={view} scope={scope} onClose={close} />;
  } else if (shareOpen) {
    sheet = <ShareSheet listId={listId} title={roster.name.trim() || undefined} flush={flush} onClose={close} />;
  } else if (choiceParam) {
    sheet = <ArmyChoiceSheet editor={editor} info={info} choiceKey={choiceParam} onClose={close} />;
  } else if (sheetParam === 'options') {
    sheet = <MoreOptionsSheet editor={editor} info={info} onClose={close} />;
  } else if (sheetParam === 'size') {
    sheet = <SizeSheet editor={editor} onClose={close} />;
  } else if (sheetParam === 'detachments') {
    sheet = <DetachmentSheet editor={editor} onClose={close} />;
  } else if (sheetParam === 'add-to') {
    sheet = <AddToSheet editor={editor} onPick={(forceSelId) => open({ add: forceSelId })} onClose={close} />;
  } else if (issuesOpen) {
    sheet = <IssuesPanel issues={issues} view={view} scope={scope} dispatch={dispatch} choiceFor={choiceFor} onChoose={onChoose} onClose={close} />;
  }
  const aside =
    wide && !issuesOpen ? <IssuesPanel issues={issues} view={view} scope={scope} dispatch={dispatch} choiceFor={choiceFor} onChoose={onChoose} inline onClose={close} /> : null;

  return (
    <div className="editor">
      <div className="editor__main">
        <EditorHeader editor={editor} listId={listId} onOpen={open} />
        {saveError && <p role="alert">{`Couldn’t save your last change: ${saveError.message}. It will be saved with your next edit.`}</p>}
        {allyError && <p role="alert">{`Couldn’t add that detachment: ${allyError.message}`}</p>}
        {view.forces.map((fv, i) => (
          <DetachmentSection
            key={fv.force.id}
            editor={editor}
            fv={fv}
            first={i === 0}
            showHeading={view.forces.length > 1}
            addButton={wide}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            onOpenUnit={openUnit}
            onAddUnit={(forceSelId, role) => open(role ? { add: forceSelId, role } : { add: forceSelId })}
            onDatasheet={(selId) => open({ datasheet: selId })}
          />
        ))}
        {!wide && view.forces.length > 0 && (
          <div className="add-bar">
            <button
              type="button"
              className="btn add-bar__add"
              onClick={() => (view.forces.length === 1 ? open({ add: view.forces[0].force.id }) : open({ sheet: 'add-to' }))}
            >
              <IconPlus size={20} aria-hidden="true" />
              Add unit
            </button>
            <button type="button" className="btn btn--icon add-bar__export" aria-label="Export or share this list" onClick={() => open({ export: '1' })}>
              <IconShare size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {aside && <div className="editor__aside">{aside}</div>}
      {sheet}
    </div>
  );
}
