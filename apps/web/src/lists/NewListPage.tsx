import type { CatalogueSummary } from '@recruit/data/model';
import type { BattleSizeId } from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import { FactionPicker } from '../factions/FactionPicker';
import { useAsync } from '../factions/useAsync';
import { useStorage } from '../storage/StorageContext';
import { createList } from './listStore';
import { applyPicks, armyChoices, defaultListName, detachmentCards, listData, sizeCards, startingRoster } from './newListSetup';

const STEPS = ['Faction', 'Battle size', 'Detachment', 'Army options'] as const;

async function loadSetup(slug: string) {
  const [scope, policy, index] = await Promise.all([getRosterScope([slug]), getPolicy(), getIndex()]);
  return { scope, policy, catalogues: index.catalogues };
}

/** Four steps on one page: faction, battle size, detachment, army options. Creating the list opens it in the editor. */
export function NewListPage() {
  const { user } = useAuth();
  const { repo } = useStorage();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [catalogue, setCatalogue] = useState<CatalogueSummary | null>(null);
  const [sizeId, setSizeId] = useState<BattleSizeId | null>(null);
  const [forceId, setForceId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [customName, setCustomName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setup = useAsync(() => (catalogue ? loadSetup(catalogue.slug) : Promise.resolve(null)), catalogue?.slug ?? '');
  const ready = setup.status === 'ready' ? setup.data : null;

  const detachments = useMemo(
    () => (ready && catalogue && sizeId ? detachmentCards(ready.scope, ready.policy, ready.catalogues, catalogue.id, sizeId) : []),
    [ready, catalogue, sizeId],
  );
  const defaultName = catalogue && sizeId ? defaultListName(catalogue, sizeId) : '';
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

  async function create(withPicks: boolean) {
    if (!user || !ready || !base || !catalogue || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const picked = applyPicks(ready.scope, base, choices, withPicks ? picks : {});
      const roster = { ...picked, name: (customName ?? defaultName).trim() || defaultName };
      const id = await createList(repo, user.id, listData(ready.scope, ready.policy, roster, catalogue));
      navigate(`/build/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Something went wrong while saving.');
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>New list</h1>
      <p className="muted" style={{ margin: '0 0 0.5rem' }}>{`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}</p>
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
                  <span>{s.points} pts</span>
                </span>
                <span className="muted">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && (
        <>
          {setup.status === 'loading' && <p className="muted">Loading detachments…</p>}
          {setup.status === 'error' && <p role="alert">Couldn’t load this faction’s army rules: {setup.error.message}</p>}
          {ready && detachments.length === 0 && <p className="muted">This faction has no detachments to start from.</p>}
          {ready && detachments.length > 0 && (
            <>
              <p className="muted">A detachment is the group of units you start your army with. You can change it later.</p>
              <ul className="list">
                {detachments.map((d) => (
                  <li key={d.forceId}>
                    <button type="button" className="choice" aria-pressed={forceId === d.forceId} onClick={() => setForceId(d.forceId)}>
                      <strong>{d.name}</strong>
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
          <label htmlFor="list-name" className="muted">
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
          {choices.map((c) => {
            const chosen = picks[c.key] ?? c.current;
            return (
              <fieldset key={c.key} className="choices">
                <legend>{c.title}</legend>
                {c.options.map((o) => (
                  <label key={o.id} className="choices__option">
                    <input
                      type="radio"
                      name={c.key}
                      checked={chosen === o.id}
                      onChange={() => setPicks((p) => ({ ...p, [c.key]: o.id }))}
                    />
                    <span>{o.name}</span>
                  </label>
                ))}
              </fieldset>
            );
          })}
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
            <button type="button" className="btn" onClick={() => void create(false)} disabled={saving || !base}>
              Decide later
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void create(true)} disabled={saving || !base}>
              Create list
            </button>
          </>
        )}
      </div>
    </section>
  );
}
