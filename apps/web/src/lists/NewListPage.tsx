import type { CatalogueSummary } from '@recruit/data/model';
import { UNTITLED_LIST, type BattleSizeId } from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { summaryLine } from '../data/entryInfo';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import { FactionPicker } from '../factions/FactionPicker';
import { useAsync } from '../factions/useAsync';
import { LoadError } from '../layout/OfflineNotice';
import { useWording } from '../rules/wording';
import { useStorage } from '../storage/StorageContext';
import { PageHeader } from '../ui/PageHeader';
import { choiceTitle } from './ArmyOptions';
import { ChoiceList } from './ChoiceList';
import { fmt } from './editorView';
import { createList, useLists } from './listStore';
import {
  applyPicks,
  armyChoices,
  defaultListName,
  detachmentCards,
  isOptionalChoice,
  listData,
  sizeCards,
  startingRoster,
  type ArmyChoice,
} from './newListSetup';
import { describeOption } from './optionText';
import { useEntryInfo } from './useEntryInfo';
import './lists.css';

const STEPS = ['Faction', 'Battle size', 'Detachment', 'Army options'] as const;
const SET_BY_DATA = '(set by your choices)';

async function loadSetup(slug: string) {
  const [scope, policy, index] = await Promise.all([getRosterScope([slug]), getPolicy(), getIndex()]);
  return { scope, policy, catalogues: index.catalogues };
}

/** Four steps on one page: faction, battle size, detachment, army options. Creating the list opens it in the editor. */
export function NewListPage() {
  const { user } = useAuth();
  const { repo } = useStorage();
  const { lists } = useLists();
  const { wording } = useWording();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [catalogue, setCatalogue] = useState<CatalogueSummary | null>(null);
  const [sizeId, setSizeId] = useState<BattleSizeId | null>(null);
  const [forceId, setForceId] = useState<string | null>(null);
  /** Choice key -> option id ('' for None), or ids for a choice that takes several. */
  const [picks, setPicks] = useState<Record<string, string | string[]>>({});
  const [customName, setCustomName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setup = useAsync(() => (catalogue ? loadSetup(catalogue.slug) : Promise.resolve(null)), catalogue?.slug ?? '');
  const ready = setup.status === 'ready' ? setup.data : null;
  const info = useEntryInfo(catalogue ? [catalogue.slug] : []);

  const detachments = useMemo(
    () =>
      ready && catalogue && sizeId
        ? detachmentCards(ready.scope, ready.policy, ready.catalogues, catalogue.id, sizeId, (id) => {
            const own = info?.get(id);
            return own ? summaryLine(own, wording) : null;
          })
        : [],
    [ready, catalogue, sizeId, info, wording],
  );
  const taken = useMemo(() => lists.map((l) => l.data.roster.name.trim() || UNTITLED_LIST), [lists]);
  const defaultName = catalogue && sizeId ? defaultListName(catalogue, sizeId, taken) : '';
  const base = useMemo(
    () => (ready && catalogue && sizeId && forceId ? startingRoster(ready.scope, { name: defaultName, catalogueId: catalogue.id, sizeId, forceId }) : null),
    [ready, catalogue, sizeId, forceId, defaultName],
  );
  const choices = useMemo(() => (ready && base ? armyChoices(ready.scope, base) : []), [ready, base]);

  const pickFaction = (c: CatalogueSummary) => {
    if (c.slug === catalogue?.slug) return;
    setCatalogue(c);
    setSizeId(null);
    setForceId(null);
    setPicks({});
    setCustomName(null);
  };
  const pickSize = (id: BattleSizeId) => {
    if (id === sizeId) return;
    setSizeId(id);
    setForceId(null);
    setPicks({});
  };

  const canNext = [catalogue !== null, sizeId !== null, forceId !== null, false][step];

  /** Creates the list with the picks made so far (Decide later leaves the rest to the editor; so does Create list). */
  async function create() {
    if (!user || !ready || !base || !catalogue || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const picked = applyPicks(ready.scope, base, choices, picks);
      const roster = { ...picked, name: (customName ?? defaultName).trim() || defaultName };
      const id = await createList(repo, user.id, listData(ready.scope, ready.policy, roster, catalogue));
      navigate(`/build/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Something went wrong while saving.');
      setSaving(false);
    }
  }

  /** One army choice as rows that say what each option does. Nothing is picked unless the player or the data picks it. */
  const choiceList = (c: ArmyChoice) => {
    if (!ready || !base) return null;
    const multi = c.max !== 1;
    const pick = picks[c.key];
    const forced = !multi && pick === undefined && c.current !== null;
    const selected = Array.isArray(pick) ? pick : pick === undefined ? (c.current ? [c.current] : []) : pick ? [pick] : [];
    const full = multi && c.max !== -1 && selected.length >= c.max;
    const options = c.options.map((o) => ({
      ...describeOption(ready.scope, info, wording, o.id, o.name),
      tag: forced && o.id === c.current ? SET_BY_DATA : undefined,
    }));
    const onPick = (id: string | null) =>
      setPicks((p) => {
        if (!multi) return { ...p, [c.key]: id ?? '' };
        const now = Array.isArray(p[c.key]) ? (p[c.key] as string[]) : [];
        return { ...p, [c.key]: id === null ? [] : now.includes(id) ? now.filter((x) => x !== id) : [...now, id] };
      });
    return (
      <ChoiceList
        key={c.key}
        name={c.key}
        legend={choiceTitle(c)}
        showLegend
        multi={multi}
        options={options}
        selected={selected}
        noneOption={!multi && isOptionalChoice(ready.scope, base, c)}
        disabledIds={full ? c.options.filter((o) => !selected.includes(o.id)).map((o) => o.id) : []}
        onPick={onPick}
      />
    );
  };

  return (
    <section className="wizard">
      <PageHeader title="New list" back={{ to: '/build', label: 'Your lists' }} subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`} />
      <div className="steps" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? 'steps__bar steps__bar--done' : 'steps__bar'} />
        ))}
      </div>

      {step === 0 && <FactionPicker onPick={pickFaction} selected={catalogue?.slug} />}

      {step === 1 && (
        <ul className="list">
          {sizeCards().map((s) => (
            <li key={s.id}>
              <button type="button" className="choice" aria-pressed={sizeId === s.id} onClick={() => pickSize(s.id)}>
                <span className="choice__head">
                  <strong>{s.name}</strong>
                  <span>{`${fmt(s.points)} pts`}</span>
                </span>
                {s.recommended && <span className="wizard__tag">Recommended for your first games</span>}
                <span className="muted">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && (
        <>
          {setup.status === 'loading' && <p className="muted">Loading detachments…</p>}
          {setup.status === 'error' && <LoadError error={setup.error} what="this faction’s army rules" />}
          {ready && detachments.length === 0 && <p className="muted">This faction has no detachments to start from.</p>}
          {ready && detachments.length > 0 && (
            <>
              <p className="muted">A detachment is the group of units you start your army with. You can change it later.</p>
              <ul className="list">
                {detachments.map((d) => (
                  <li key={d.forceId}>
                    <button type="button" className="choice" aria-pressed={forceId === d.forceId} onClick={() => setForceId(d.forceId)}>
                      <strong>{d.name}</strong>
                      {d.summary && <span className="wizard__summary">{d.summary}</span>}
                      <span className="muted">{d.slots}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <label htmlFor="list-name" className="label-caps">
            List name
          </label>
          <input
            id="list-name"
            className="input"
            value={customName ?? defaultName}
            onChange={(e) => setCustomName(e.target.value)}
            style={{ margin: '0.25rem 0 1rem' }}
          />
          {choices.length === 0 ? (
            <p className="muted">Nothing to decide for this army yet. You can add units next.</p>
          ) : (
            <p className="muted">These shape your army. You can pick now or decide later.</p>
          )}
          <div className="wizard__choices">{choices.map(choiceList)}</div>
          {saveError && <p role="alert">Couldn’t save the list: {saveError}</p>}
        </>
      )}

      <div className="wizard-actions">
        {step > 0 && (
          <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={saving}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
            Next
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => void create()} disabled={saving || !base}>
              Decide later
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void create()} disabled={saving || !base}>
              Create list
            </button>
          </>
        )}
      </div>
    </section>
  );
}
