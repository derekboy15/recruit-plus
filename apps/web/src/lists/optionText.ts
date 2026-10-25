/** What the builder says about an option: its display name, its one-line effect and its full info. No React. */
import { optionDisplay, type Scope } from '@recruit/data/roster';
import { entryInfo, summaryLine, type EntryInfoIndex } from '../data/entryInfo';
import type { Wording } from '../rules/wording';
import type { ChoiceOption } from './ChoiceList';

/**
 * One option as ChoiceList shows it: the name without BattleScribe's prefixes, the first sentence of what it does in the
 * chosen wording (null with no text or no info loaded), and whether that sentence is the official wording although plain
 * English was chosen.
 */
export function describeOption(scope: Scope, index: EntryInfoIndex | null, wording: Wording, entryId: string, bsName: string): ChoiceOption {
  const info = entryInfo(scope, index, entryId);
  const plain = info ? summaryLine(info, 'plain') : null;
  const official = info ? summaryLine(info, 'official') : null;
  return {
    id: entryId,
    label: optionDisplay(bsName).name,
    summary: wording === 'plain' ? plain : official,
    info,
    official: plain !== null && plain === official,
  };
}
