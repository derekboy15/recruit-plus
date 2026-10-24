import type { Inline } from '@recruit/data/model';

/** The text with its first letter upper-cased: guide blurbs written mid-sentence ("each Command phase…") start a card. */
export function capitalised(c: Inline[]): Inline[] {
  let done = false;
  const walk = (nodes: Inline[]): Inline[] =>
    nodes.map((x) => {
      if (done) return x;
      if (x.t === 'text') {
        if (!x.v) return x;
        done = true;
        return { ...x, v: x.v.charAt(0).toUpperCase() + x.v.slice(1) };
      }
      return { ...x, c: walk(x.c) };
    });
  return walk(c);
}
