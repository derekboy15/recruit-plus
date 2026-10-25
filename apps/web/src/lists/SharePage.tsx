/**
 * The read-only page behind a share link: the same army view as Play mode. Opens without signing in; nothing here edits
 * the shared list. A signed-in visitor can save a copy of it to their own lists.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../factions/useAsync';
import { useStorage } from '../storage/StorageContext';
import { PageHeader } from '../ui/PageHeader';
import { CopyButton } from './ExportSheet';
import { fmt, problemsLabel } from './editorView';
import { createList, type ListData } from './listStore';
import { loadPlayData, type PlayData } from './play/loadPlayData';
import { PlayArmyView } from './play/PlayArmyView';
import { PlaySheets } from './play/PlaySheets';
import { usePlaySheetParam } from './play/usePlaySheetParam';
import { usePublicSource } from './publicSource';

const HOME = { to: '/', label: 'Home' };

const buildYourOwn = (
  <Link to="/" className="btn">
    Build your own
  </Link>
);

interface Shared { data: PlayData; list: ListData; updatedAt: number }

function SharedList({ shared }: { shared: Shared }) {
  const { data, list, updatedAt } = shared;
  const { army, issues } = data;
  const { user } = useAuth();
  const { repo } = useStorage();
  const navigate = useNavigate();
  const [open, setOpen] = usePlaySheetParam(army.units);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const updated = new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const saveToMine = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      navigate(`/build/${await createList(repo, user.id, list)}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={army.name} subtitle={`${army.faction} · ${army.sizeName}`} back={HOME} />
      <div className="share-intro">
        <p className="share__totals">
          <span className="share__pts">{`${fmt(army.points)} / ${fmt(army.pointsLimit)} pts`}</span>
          <span className="muted">{` · ${fmt(army.powerLevel)} PL · ${fmt(army.commandPoints)} CP `}</span>
          <span className={`status ${issues.length ? 'status--bad' : 'status--ok'}`}>{problemsLabel(issues.length)}</span>
        </p>
        <p className="muted">{`Read-only copy, last updated ${updated}.`}</p>
        {saveError && (
          <p role="alert" className="play-error">
            {`Couldn’t save this list: ${saveError}`}
          </p>
        )}
        <div className="sheet-actions">
          <CopyButton text={data.text} label="Copy list" failedLabel="Couldn’t copy on this device" className="btn" />
          {user ? (
            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void saveToMine()}>
              Save to my lists
            </button>
          ) : (
            buildYourOwn
          )}
        </div>
      </div>
      <PlayArmyView data={data} onOpen={setOpen} />
      {open && <PlaySheets data={data} open={open} onOpen={setOpen} />}
    </>
  );
}

export function SharePage() {
  const { id = '' } = useParams();
  const { source } = usePublicSource();
  const state = useAsync(
    () => source.get(id).then((f) => f && loadPlayData(f.data).then((data): Shared => ({ data, list: f.data, updatedAt: f.updatedAt }))),
    id,
  );

  if (state.status === 'loading') {
    return (
      <>
        <PageHeader title="Shared list" back={HOME} />
        <p className="muted">Loading the list…</p>
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <PageHeader title="Shared list" back={HOME} />
        <p role="alert">{`Couldn’t open this list: ${state.error.message}`}</p>
        {buildYourOwn}
      </>
    );
  }
  if (!state.data) {
    return (
      <>
        <PageHeader title="List not found" back={HOME} />
        <p>This list isn't shared, or the link is wrong.</p>
        {buildYourOwn}
      </>
    );
  }
  return <SharedList shared={state.data} />;
}
