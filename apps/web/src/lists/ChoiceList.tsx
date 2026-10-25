/** Radio or checkbox rows that each say what the option does, with an ⓘ for its full text. */
import type { EntryInfo, InfoProfile } from '@recruit/data/model';
import { useId } from 'react';
import { RulesText } from '../rules/RulesText';
import { useWording } from '../rules/wording';
import { WeaponCard } from '../ui/datasheet';
import { InfoButton } from '../ui/InfoButton';

export interface ChoiceOption {
  id: string;
  label: string;
  /** One line saying what it does (summaryLine), or null when there is none. */
  summary: string | null;
  info: EntryInfo | undefined;
  /** The summary is the official wording (no plain English yet): labelled so while plain English is chosen. */
  official?: boolean;
  /** A short note before the summary, such as "(set by your choices)". */
  tag?: string;
}

export interface ChoiceListProps {
  /** The radio group's name. */
  name: string;
  /** The fieldset's legend (visually hidden unless `showLegend`: a sheet's title already says it). */
  legend: string;
  showLegend?: boolean;
  /** Checkboxes (a group that takes several) instead of radios. */
  multi: boolean;
  options: ChoiceOption[];
  selected: string[];
  /** Shows "None" first (an optional group). */
  noneOption?: boolean;
  /** null: None. */
  onPick(id: string | null): void;
  disabledIds?: string[];
}

const words = (s: string) => s.trim().split(/\s+/).length;
const hasInfo = (info: EntryInfo | undefined): info is EntryInfo => !!info && !!(info.profiles?.length || info.rules?.length);

function ProfileBlock({ p }: { p: InfoProfile }) {
  if (p.type === 'Weapon') return <WeaponCard weapon={p} />;
  const entries = Object.entries(p.chars).filter(([, v]) => v.trim() && v.trim() !== '-');
  return (
    <section className="option-info__block">
      <h3 className="option-info__name">{p.name}</h3>
      {p.type && <p className="label-caps option-info__kind">{p.type}</p>}
      {entries.map(([key, value]) =>
        words(value) > 3 ? (
          <RulesText key={key} official={value} plain={p.plain?.[key]} />
        ) : (
          <p key={key} className="option-info__char">
            <span className="muted">{key}:</span> {value}
          </p>
        ),
      )}
    </section>
  );
}

/** Everything an option's info holds: its abilities and rules in the chosen wording, and its weapon profiles. */
export function OptionInfo({ info }: { info: EntryInfo }) {
  return (
    <div className="option-info">
      {info.profiles?.map((p, i) => <ProfileBlock key={`p${i}`} p={p} />)}
      {info.rules?.map((r, i) => (
        <section key={`r${i}`} className="option-info__block">
          <h3 className="option-info__name">{r.name}</h3>
          <RulesText official={r.text} plain={r.plain} />
        </section>
      ))}
    </div>
  );
}

/** The ⓘ for an option: nothing at all when there is no text to show. */
export function OptionInfoButton({ label, info }: { label: string; info: EntryInfo | undefined }) {
  if (!hasInfo(info)) return null;
  return (
    <InfoButton label={`About ${label}`} title={label}>
      <OptionInfo info={info} />
    </InfoButton>
  );
}

export function ChoiceList({ name, legend, showLegend = false, multi, options, selected, noneOption = false, onPick, disabledIds = [] }: ChoiceListProps) {
  const id = useId();
  const { wording } = useWording();
  const type = multi ? 'checkbox' : 'radio';
  const none = noneOption && !multi;
  return (
    <fieldset className="choice-list">
      <legend className={showLegend ? 'label-caps choice-list__legend' : 'sr-only'}>{legend}</legend>
      {none && (
        <div className={selected.length === 0 ? 'choice-row choice-row--on' : 'choice-row'}>
          <label className="choice-row__label">
            <input type="radio" name={name} checked={selected.length === 0} onChange={() => onPick(null)} />
            <span className="choice-row__text">
              <span className="choice-row__name">None</span>
            </span>
          </label>
        </div>
      )}
      {options.map((o, i) => {
        const on = selected.includes(o.id);
        const nameId = `${id}-${i}-name`;
        const summaryId = `${id}-${i}-summary`;
        return (
          <div key={o.id} className={on ? 'choice-row choice-row--on' : 'choice-row'}>
            <label className="choice-row__label">
              <input
                type={type}
                name={multi ? undefined : name}
                checked={on}
                disabled={!on && disabledIds.includes(o.id)}
                aria-labelledby={nameId}
                aria-describedby={o.summary || o.tag ? summaryId : undefined}
                onChange={() => onPick(o.id)}
              />
              <span className="choice-row__text">
                <span id={nameId} className="choice-row__name">
                  {o.label}
                </span>
                {(o.summary || o.tag) && (
                  <span id={summaryId} className="choice-row__summary">
                    {o.tag && (
                      <>
                        <span className="choice-row__tag">{o.tag}</span>
                        {o.summary && ' '}
                      </>
                    )}
                    {o.official && wording === 'plain' && (
                      <>
                        <span className="rules-text__label choice-row__official">Official wording</span>{' '}
                      </>
                    )}
                    {o.summary}
                  </span>
                )}
              </span>
            </label>
            <OptionInfoButton label={o.label} info={o.info} />
          </div>
        );
      })}
    </fieldset>
  );
}
