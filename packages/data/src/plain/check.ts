/**
 * Checks a plain-English rules text against its official text: every number, dice expression and keyword in the
 * official text must survive, no dice/roll/modifier/distance may be invented, and no long run of official wording may
 * be copied. Browser-safe: no Node imports.
 */

export type TokenKind = 'dice' | 'roll' | 'mod' | 'dist' | 'mult' | 'num' | 'kw';
/** Canonical value: 'D3+3', '5+', '+1', '6"', 'x2', '3', 'CORE INFANTRY'. */
export interface Token { kind: TokenKind; value: string }

/** Curly quotes and dashes to plain ones, inch words and spaced inch marks to `"`, whitespace collapsed. */
export function normaliseRulesText(s: string): string {
  return s
    .replace(/[″“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/(\d)½/g, '$1.5')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d+)\s*(?:inches|inch)\b/gi, '$1"')
    .replace(/(\d+)\s*"/g, '$1"')
    .trim();
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];
const ORDINAL_WORDS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
];

/**
 * Numbers spelled out read as digits. ALL-CAPS words are keywords (GREAT UNCLEAN ONE) and stay. In official text "zero",
 * "one" and "first" stay words: "one unit" is everywhere and is rarely a value a player could get wrong.
 */
const OFFICIAL_SKIP = new Set(['zero', 'one', 'first']);
function numberWordsToDigits(s: string, official = false): string {
  return s.replace(/\b[a-z]+\b/gi, (w) => {
    if (w.length > 1 && w === w.toUpperCase()) return w;
    const lower = w.toLowerCase();
    if (official && OFFICIAL_SKIP.has(lower)) return w;
    const n = NUMBER_WORDS.indexOf(lower);
    if (n >= 0) return String(n);
    const o = ORDINAL_WORDS.indexOf(lower);
    return o > 0 ? String(o) : w;
  });
}

interface Found extends Token { at: number }

/** The token rules, in the order they consume text. */
const RULES: { kind: Exclude<TokenKind, 'kw'>; re: RegExp; value: (m: RegExpExecArray) => string }[] = [
  {
    kind: 'dice',
    re: /\b(\d*)D(\d+)(?:\s*([+-])\s*(\d+))?\b/gi,
    value: (m) => `${m[1] && m[1] !== '1' ? m[1] : ''}D${m[2]}${m[3] ? `${m[3]}${m[4]}` : ''}`,
  },
  { kind: 'roll', re: /\b(\d+)\+(?!\d)/g, value: (m) => `${m[1]}+` },
  { kind: 'mod', re: /(?<![\w"])([+-])(\d+)\b/g, value: (m) => `${m[1]}${m[2]}` },
  { kind: 'dist', re: /\b(\d+(?:\.\d+)?)"/g, value: (m) => `${m[1]}"` },
  { kind: 'mult', re: /(?<!\w)x(\d+)\b/gi, value: (m) => `x${m[1]}` },
  // A full stop after a number ends the sentence ("subtract 1."); a decimal ("1.5") is read as one number.
  { kind: 'num', re: /(?<!\w|\d\.)(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?!\d|\.\d)/g, value: (m) => m[1].replace(/,/g, '') },
];

const KW_WORD = /^<?[A-Z][A-Z0-9'-]*>?$/;
const letters = (w: string) => w.replace(/[^A-Z]/g, '').length;

/** Maximal runs of ALL-CAPS words; punctuation between words ends a run. */
function keywordRuns(masked: string): Found[] {
  const out: Found[] = [];
  let run: string[] = [];
  let start = 0;
  const flush = () => {
    if (run.length) out.push({ kind: 'kw', value: run.join(' '), at: start });
    run = [];
  };
  for (const m of masked.matchAll(/\S+/g)) {
    const raw = m[0];
    const lead = raw.match(/^[("'[]+/)?.[0] ?? '';
    let word = raw.slice(lead.length);
    // A trailing hyphen is left when a number is masked out of "AP-1".
    const trail = word.match(/[)"'\],.;:!?-]+$/)?.[0] ?? '';
    word = word.slice(0, word.length - trail.length).replace(/'s$/, '');
    const isKw = KW_WORD.test(word) && letters(word) >= 2;
    if (!isKw || lead) flush();
    if (isKw) {
      if (!run.length) start = m.index;
      run.push(word);
    }
    if (trail) flush();
  }
  flush();
  return out;
}

function extract(text: string, plain: boolean): Found[] {
  let work = normaliseRulesText(numberWordsToDigits(text, !plain));
  const found: Found[] = [];
  for (const rule of RULES) {
    work = work.replace(rule.re, (...args) => {
      const match = args[0] as string;
      const at = args[args.length - 2] as number;
      const groups = [match, ...(args.slice(1, -2) as string[])] as unknown as RegExpExecArray;
      found.push({ kind: rule.kind, value: rule.value(groups), at });
      return ' '.repeat(match.length);
    });
  }
  found.push(...keywordRuns(work));
  found.sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  return found.filter((t) => {
    const key = `${t.kind}:${t.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The numbers, dice and keywords a rules text depends on, deduplicated, in first-seen order. */
export function extractTokens(text: string): Token[] {
  return extract(text, false).map(({ kind, value }) => ({ kind, value }));
}

export interface CrossCheck { missing: Token[]; extra: Token[] }

/** Every numeric value a token carries, for matching a bare official number. */
function numericValues(t: Token): string[] {
  switch (t.kind) {
    case 'num': return [t.value];
    case 'roll': return [t.value.slice(0, -1)];
    case 'mod': return [t.value.slice(1)];
    case 'dist': return [t.value.slice(0, -1)];
    case 'mult': return [t.value.slice(1)];
    case 'dice': {
      const m = /^(\d*)D\d+(?:[+-](\d+))?$/.exec(t.value)!;
      return [m[1], m[2]].filter(Boolean);
    }
    default: return [];
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hasKeyword(plain: string, run: string): boolean {
  const body = run.split(' ').map(escape).join('\\s+');
  // A number may touch a keyword ("2CP"); a letter may not.
  return new RegExp(`(?<![A-Za-z<])${body}s?(?![\\w>])`, 'i').test(plain);
}

const STRICT: TokenKind[] = ['dice', 'roll', 'mod', 'dist', 'mult'];

export function crossCheck(official: string, plain: string): CrossCheck {
  const off = extractTokens(official);
  const pl = extract(plain, true);
  const plainText = normaliseRulesText(numberWordsToDigits(plain));
  const has = (t: Token) => pl.some((p) => p.kind === t.kind && p.value === t.value);
  const missing = off.filter((t) => {
    if (t.kind === 'kw') return !hasKeyword(plainText, t.value);
    if (t.kind === 'num') return !pl.some((p) => numericValues(p).includes(t.value));
    return !has(t);
  });
  const extra = pl
    .filter((p) => STRICT.includes(p.kind) && !off.some((t) => t.kind === p.kind && t.value === p.value))
    .map(({ kind, value }) => ({ kind, value }));
  return { missing, extra };
}

export interface CopyCheck { longestRun: number; shared4: number; copied: boolean }

const copyWords = (s: string) =>
  normaliseRulesText(s)
    .toLowerCase()
    .split(/[^a-z0-9'"+<>-]+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);

const grams = (w: string[]) => new Set(w.slice(0, Math.max(0, w.length - 3)).map((_, i) => w.slice(i, i + 4).join(' ')));

/** Longest shared run of consecutive words, and the share of the plain text's word 4-grams found in the official text. */
export function copyCheck(official: string, plain: string): CopyCheck {
  const a = copyWords(official);
  const b = copyWords(plain);
  let longestRun = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > longestRun) longestRun = cur[j];
      }
    }
    prev = cur;
  }
  const plainGrams = grams(b);
  const officialGrams = grams(a);
  const shared = [...plainGrams].filter((g) => officialGrams.has(g)).length;
  const shared4 = plainGrams.size ? shared / plainGrams.size : 0;
  return { longestRun, shared4, copied: longestRun >= 12 || (a.length >= 20 && shared4 >= 0.5) };
}

export interface PlainVerdict { ok: boolean; missing: Token[]; extra: Token[]; copy: CopyCheck }

/** The full verdict; tokens whose value is waived (with a reason) don't count. Copying can't be waived. */
export function checkPlain(official: string, plain: string, waive: Record<string, string> = {}): PlainVerdict {
  const { missing, extra } = crossCheck(official, plain);
  const keep = (t: Token) => !(t.value in waive);
  const copy = copyCheck(official, plain);
  const m = missing.filter(keep);
  const e = extra.filter(keep);
  return { ok: !m.length && !e.length && !copy.copied, missing: m, extra: e, copy };
}
