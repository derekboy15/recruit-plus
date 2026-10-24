import { BATTLE_SIZES, UNTITLED_LIST } from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import { FactionBadge } from '../ui/FactionBadge';
import { IconCheck, IconCopy, IconDelete, IconEdit, IconPlay, IconPlus, IconSearch, IconShare, IconWarning } from '../ui/icons';
import { Menu } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { relativeTime } from '../ui/relativeTime';
import { useToast } from '../ui/toast';
import { fmt, plural } from './editorView';
import { deleteList, duplicateList, renameList, restoreList, useLists, type ListData } from './listStore';
import { RenameSheet } from './RenameSheet';
import './lists.css';

/** The search box shows once the player has this many lists. */
const SEARCH_FROM = 6;
const ICON = 18;

const listName = (l: Doc<ListData>) => l.data.roster.name.trim() || UNTITLED_LIST;

/** "Ready" or "2 to fix", then when the list was last edited. */
function ListStatus({ list }: { list: Doc<ListData> }) {
  const problems = list.data.summary.issueCount;
  return (
    <span className="list-card__status">
      {problems === 0 ? (
        <span className="list-card__ok">
          <IconCheck size={13} strokeWidth={2.8} aria-hidden="true" />
          Ready
        </span>
      ) : (
        <span className="list-card__fix">
          <IconWarning size={13} strokeWidth={2.4} aria-hidden="true" />
          {`${fmt(problems)} to fix`}
        </span>
      )}
      {` · Edited ${relativeTime(list.updatedAt)}`}
    </span>
  );
}

export function ListsPage() {
  const { lists, loading, error } = useLists();
  const { user } = useAuth();
  const { repo } = useStorage();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<Doc<ListData> | null>(null);

  const q = query.trim().toLowerCase();
  const searching = lists.length >= SEARCH_FROM && q !== '';
  const shown = useMemo(
    () => (searching ? lists.filter((l) => listName(l).toLowerCase().includes(q) || l.data.summary.faction.toLowerCase().includes(q)) : lists),
    [lists, searching, q],
  );
  const taken = lists.map(listName);

  const remove = async (l: Doc<ListData>) => {
    try {
      const was = await deleteList(repo, l.id);
      toast.show({ message: `Deleted “${listName(l)}”`, action: { label: 'Undo', onAction: () => void restoreList(repo, was) } });
    } catch (e) {
      toast.show({ message: `Couldn’t delete “${listName(l)}”: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const duplicate = async (l: Doc<ListData>) => {
    if (!user) return;
    try {
      const id = await duplicateList(repo, user.id, l.id, taken);
      const copy = await repo.getDoc<ListData>(id);
      toast.show({ message: `Duplicated as “${copy ? listName(copy) : listName(l)}”` });
    } catch (e) {
      toast.show({ message: `Couldn’t duplicate “${listName(l)}”: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const rename = async (l: Doc<ListData>, name: string) => {
    setRenaming(null);
    try {
      await renameList(repo, l.id, name);
    } catch (e) {
      toast.show({ message: `Couldn’t rename “${listName(l)}”: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  return (
    <section className="lists-page">
      <PageHeader
        variant="top"
        title="Your lists"
        actions={
          <Link to="/build/new" className="btn btn--primary lists-page__new">
            <IconPlus size={ICON} strokeWidth={2.4} aria-hidden="true" />
            New list
          </Link>
        }
      />
      {lists.length >= SEARCH_FROM && (
        <div className="lists-search">
          <IconSearch size={ICON} aria-hidden="true" />
          <input
            type="search"
            className="lists-search__input"
            aria-label="Search your lists"
            placeholder="Search by name or faction"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {loading && <p className="muted">Loading your lists…</p>}
      {error && <p role="alert">Couldn’t read your saved lists on this device: {error.message}</p>}
      {!loading && !error && lists.length === 0 && <p className="muted">No lists yet. Build your first army: it takes a couple of minutes.</p>}
      {lists.length > 0 && <p className="lists-page__count">{plural(lists.length, 'list', 'lists')}</p>}
      {searching && shown.length === 0 && <p className="muted">{`No lists match “${query.trim()}”.`}</p>}
      <ul className="list-cards">
        {shown.map((l) => {
          const { summary } = l.data;
          const name = listName(l);
          return (
            <li key={l.id} className="list-card">
              <Link to={`/build/${l.id}`} className="list-card__link">
                <FactionBadge slug={summary.catalogueSlug} name={summary.faction} />
                <span className="list-card__text">
                  <span className="list-card__name">{name}</span>
                  <span className="list-card__meta">
                    {`${summary.faction} · ${BATTLE_SIZES[summary.battleSize]?.name ?? summary.battleSize} · ${fmt(summary.points)} / ${fmt(summary.pointsLimit)} pts`}
                  </span>
                  <ListStatus list={l} />
                </span>
              </Link>
              <Menu
                label={`Actions for ${name}`}
                items={[
                  { label: 'Play', icon: <IconPlay size={ICON} aria-hidden="true" />, to: `/build/${l.id}/play` },
                  { label: 'Edit', icon: <IconEdit size={ICON} aria-hidden="true" />, to: `/build/${l.id}` },
                  { label: 'Duplicate', icon: <IconCopy size={ICON} aria-hidden="true" />, onSelect: () => void duplicate(l) },
                  { label: 'Rename', icon: <span className="menu-spacer" />, onSelect: () => setRenaming(l) },
                  { label: 'Export or share', icon: <IconShare size={ICON} aria-hidden="true" />, to: `/build/${l.id}?export=1` },
                  { label: 'Delete', icon: <IconDelete size={ICON} aria-hidden="true" />, onSelect: () => void remove(l), danger: true },
                ]}
              />
            </li>
          );
        })}
      </ul>
      {renaming && <RenameSheet name={listName(renaming)} onSave={(name) => void rename(renaming, name)} onClose={() => setRenaming(null)} />}
    </section>
  );
}
