import {
  BATTLE_SIZES,
  COST_CP,
  COST_PTS,
  stripCpSuffix,
  UNTITLED_LIST,
} from "@recruit/data/roster";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { factionDisplayName } from "../factions/names";
import { useStorage } from "../storage/StorageContext";
import {
  IconCheck,
  IconCopy,
  IconDelete,
  IconEdit,
  IconPlay,
  IconRedo,
  IconShare,
  IconUndo,
  IconWarning,
} from "../ui/icons";
import { Menu } from "../ui/Menu";
import { PageHeader } from "../ui/PageHeader";
import { useToast } from "../ui/toast";
import { ArmyChoiceChips } from "./ArmyOptions";
import { fmt, plural } from "./editorView";
import {
  deleteList,
  duplicateList,
  restoreList,
  type ListData,
} from "./listStore";
import { RenameSheet } from "./RenameSheet";
import type { ReadyEditor } from "./useRosterEditor";

interface Props {
  editor: ReadyEditor;
  listId: string;
  /** Opens a sheet by its URL params (`{ issues: '1' }`, `{ sheet: 'size' }`…). */
  onOpen: (p: Record<string, string>) => void;
}

const ICON = 18;

/**
 * The editor's header: Back, the list's name, undo and redo, the list's ⋯ menu and Play. Under it the summary: the
 * points meter, what is left, and chips for the army's choices, battle size, detachments and problems.
 */
export function EditorHeader({ editor, listId, onOpen }: Props) {
  const {
    roster,
    view,
    issues,
    catalogues,
    dispatch,
    flush,
    undo,
    redo,
    canUndo,
    canRedo,
  } = editor;
  const { repo } = useStorage();
  const navigate = useNavigate();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);

  const name = roster.name.trim() || UNTITLED_LIST;
  const catalogue = catalogues.find((c) => c.id === roster.catalogueId);
  const faction = catalogue ? factionDisplayName(catalogue.name) : "";
  const size = BATTLE_SIZES[roster.battleSize];
  const pts = view.total[COST_PTS] ?? 0;
  const limit = size?.points ?? 0;
  const over = pts > limit;
  const cp = view.total[COST_CP] ?? 0;
  const text = `${fmt(pts)} / ${fmt(limit)} pts`;
  const detachments =
    view.forces.length === 1
      ? stripCpSuffix(view.forces[0].name)
      : plural(view.forces.length, "detachment", "detachments");

  const failed = (what: string, e: unknown) =>
    toast.show({
      message: `Couldn’t ${what}: ${e instanceof Error ? e.message : String(e)}`,
    });
  const remove = async () => {
    try {
      // Unsaved edits are saved first, so the editor's last save can't bring the list back once it has gone.
      await flush();
      const was = await deleteList(repo, listId);
      navigate("/build");
      toast.show({
        message: `Deleted “${name}”`,
        action: { label: "Undo", onAction: () => void restoreList(repo, was) },
      });
    } catch (e) {
      failed("delete this list", e);
    }
  };
  const duplicate = async () => {
    try {
      await flush();
      const doc = await repo.getDoc<ListData>(listId);
      if (!doc) throw new Error("That list no longer exists.");
      const taken = (await repo.listDocs<ListData>("list", doc.ownerId)).map(
        (l) => l.data.roster.name.trim() || UNTITLED_LIST,
      );
      const id = await duplicateList(repo, doc.ownerId, listId, taken);
      const copy = await repo.getDoc<ListData>(id);
      toast.show({
        message: `Duplicated as “${copy?.data.roster.name ?? name}”`,
        action: { label: "Open", onAction: () => navigate(`/build/${id}`) },
      });
    } catch (e) {
      failed("duplicate this list", e);
    }
  };

  return (
    <>
      <div className="editor-top">
        <PageHeader
          back={{ to: "/build", label: "Your lists" }}
          title={name}
          subtitle={[faction, size?.name].filter(Boolean).join(" · ")}
          actions={
            <>
              <button
                type="button"
                className="btn btn--icon"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={undo}
              >
                <IconUndo size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn--icon"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={redo}
              >
                <IconRedo size={20} aria-hidden="true" />
              </button>
              <Menu
                label="List actions"
                items={[
                  {
                    label: "Rename",
                    icon: <IconEdit size={ICON} aria-hidden="true" />,
                    onSelect: () => setRenaming(true),
                  },
                  {
                    label: "Duplicate list",
                    icon: <IconCopy size={ICON} aria-hidden="true" />,
                    onSelect: () => void duplicate(),
                  },
                  {
                    label: "Export",
                    icon: <span className="menu-spacer" />,
                    onSelect: () => onOpen({ export: "1" }),
                  },
                  {
                    label: "Share link",
                    icon: <IconShare size={ICON} aria-hidden="true" />,
                    onSelect: () => onOpen({ share: "1" }),
                  },
                  {
                    label: "Delete list",
                    icon: <IconDelete size={ICON} aria-hidden="true" />,
                    onSelect: () => void remove(),
                    danger: true,
                  },
                ]}
              />
              <Link
                to={`/build/${listId}/play`}
                className="btn btn--primary editor-top__play"
              >
                <IconPlay size={ICON} fill="currentColor" aria-hidden="true" />
                <span className="editor-top__play-label">Play</span>
              </Link>
            </>
          }
        />
        <section className="summary" aria-label="List summary">
          <div className="summary__row">
            <div
              className="summary__points"
              role="meter"
              aria-label="Points"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={pts}
              aria-valuetext={text}
              aria-invalid={over}
            >
              {fmt(pts)}{" "}
              <span className="summary__limit">{`/ ${fmt(limit)} pts`}</span>
            </div>
            <p
              className={
                over ? "summary__left summary__left--over" : "summary__left"
              }
            >
              {over
                ? `${fmt(pts - limit)} pts over`
                : `${fmt(limit - pts)} pts left`}
              {cp !== 0 && (
                <span className="summary__cp">{` · ${fmt(cp)} CP`}</span>
              )}
            </p>
          </div>
          <span
            className={
              over ? "summary__bar summary__bar--over" : "summary__bar"
            }
            aria-hidden="true"
          >
            <span
              className="summary__fill"
              style={{
                width: `${limit ? Math.min(100, (pts / limit) * 100) : 0}%`,
              }}
            />
          </span>
        </section>
      </div>
      {/* The chips wrap (as on the Main artboard) and scroll away, so every one, the status chip included, is on screen. */}
      <div className="summary-chips">
        <ArmyChoiceChips editor={editor} onOpen={onOpen} />
        <button
          type="button"
          className="chip"
          onClick={() => onOpen({ sheet: "size" })}
        >
          {`${size?.name ?? roster.battleSize} · ${fmt(limit)} pts`}
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => onOpen({ sheet: "detachments" })}
        >
          {detachments}
        </button>
        {issues.length === 0 ? (
          <button
            type="button"
            className="chip chip--ok"
            onClick={() => onOpen({ issues: "1" })}
          >
            <IconCheck size={15} strokeWidth={2.8} aria-hidden="true" />
            All checks pass
          </button>
        ) : (
          <button
            type="button"
            className="chip chip--warn"
            onClick={() => onOpen({ issues: "1" })}
          >
            <IconWarning size={15} aria-hidden="true" />
            {`${fmt(issues.length)} to fix`}
          </button>
        )}
      </div>
      {renaming && (
        <RenameSheet
          name={name}
          onClose={() => setRenaming(false)}
          onSave={(next) => {
            setRenaming(false);
            dispatch({ type: "rename", name: next });
          }}
        />
      )}
    </>
  );
}
