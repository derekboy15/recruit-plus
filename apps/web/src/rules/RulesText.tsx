import { useWording } from './wording';

/** One rules text in the chosen wording; the official wording stands in (labelled) where no checked plain English exists. */
export function RulesText({ official, plain, amended }: { official: string; plain?: string; amended?: string }) {
  const { wording } = useWording();
  const showPlain = wording === 'plain' && !!plain;
  return (
    <>
      {wording === 'plain' && !plain && <p className="rules-text__label muted">Official wording (plain-English version not ready yet)</p>}
      <p className="rules-text">{showPlain ? plain : official}</p>
      {amended && <p className="note note--update">Rules update: {amended}</p>}
    </>
  );
}
