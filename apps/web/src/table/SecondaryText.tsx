import type { SecondaryOut } from '@recruit/data/missions';
import { RulesText } from '../rules/RulesText';

export const SECONDARY_TYPE: Record<SecondaryOut['type'], string> = {
  progressive: 'Progressive',
  'end-game': 'End game',
  'progressive-and-end-game': 'Progressive and end game',
};

/** A secondary objective's full text: its category and when it scores, any faction note, then the rule itself. */
export function SecondaryText({ s }: { s: SecondaryOut & { note?: string } }) {
  return (
    <>
      <p className="muted">{s.category} · {SECONDARY_TYPE[s.type]}</p>
      {s.note && <p className="note">{s.note}</p>}
      <RulesText official={s.text} plain={s.plain} amended={s.amended} />
    </>
  );
}
