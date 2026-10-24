/** Play mode (/build/:id/play): a list on this device, read only, for the table. Edit goes to the editor. */
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LoadError } from '../../layout/OfflineNotice';
import { IconEdit, IconPlay } from '../../ui/icons';
import { PageHeader } from '../../ui/PageHeader';
import { fmt } from '../editorView';
import { usePlayList } from './loadPlayData';
import { PlayArmyView } from './PlayArmyView';
import { PlaySheets } from './PlaySheets';
import { usePlaySheetParam } from './usePlaySheetParam';

const BACK = { to: '/build', label: 'Your lists' };

export function PlayPage() {
  const { id = '' } = useParams();
  const state = usePlayList(id);
  const [open, setOpen] = usePlaySheetParam();

  // A link to a unit this list no longer has opens nothing, and the URL stops saying it does.
  const stale = state.status === 'ready' && open?.kind === 'unit' && !state.data.army.units.some((u) => u.selId === open.selId);
  useEffect(() => {
    if (stale) setOpen(null);
  }, [stale, setOpen]);

  if (state.status === 'loading') {
    return (
      <>
        <PageHeader title="Play mode" back={BACK} />
        <p className="muted">Loading your army…</p>
      </>
    );
  }
  if (state.status === 'missing') {
    return (
      <>
        <PageHeader title="List not found" back={BACK} />
        <p>We couldn’t find this list on this device. It may have been deleted.</p>
        <Link to="/build">Back to your lists</Link>
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <PageHeader title="Play mode" back={BACK} />
        <LoadError error={state.error} what="this list" />
      </>
    );
  }

  const { data } = state;
  return (
    <>
      <PageHeader
        title={data.army.name}
        subtitle={
          <span className="play-mode-sub">
            <IconPlay size={12} aria-hidden="true" />
            {`Play mode · read only · ${fmt(data.army.points)} pts`}
          </span>
        }
        back={BACK}
        actions={
          <Link to={`/build/${id}`} className="btn btn--small">
            <IconEdit size={16} aria-hidden="true" />
            Edit
          </Link>
        }
      />
      <PlayArmyView data={data} onOpen={setOpen} />
      {open && !stale && <PlaySheets data={data} open={open} onOpen={setOpen} />}
    </>
  );
}
