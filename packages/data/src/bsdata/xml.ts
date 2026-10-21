import { XMLParser } from 'fast-xml-parser';
import type { RawNode } from './types';

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});

type OrderedNode = Record<string, unknown> & { ':@'?: Record<string, string> };

function convert(node: OrderedNode): RawNode | null {
  const tag = Object.keys(node).find((k) => k !== ':@');
  if (!tag || tag === '#text' || tag === '?xml') return null;
  const kids = (node[tag] as OrderedNode[]) ?? [];
  const out: RawNode = { tag, attrs: node[':@'] ?? {}, children: [] };
  const texts: string[] = [];
  for (const kid of kids) {
    if ('#text' in kid) texts.push(String(kid['#text']));
    else {
      const c = convert(kid);
      if (c) out.children.push(c);
    }
  }
  if (texts.length) out.text = texts.join('');
  return out;
}

/** Parse a .gst or .cat document into its root element. */
export function parseBsXml(xml: string): RawNode {
  const doc = parser.parse(xml) as OrderedNode[];
  for (const n of doc) {
    const c = convert(n);
    if (c) return c;
  }
  throw new Error('No root element found');
}
