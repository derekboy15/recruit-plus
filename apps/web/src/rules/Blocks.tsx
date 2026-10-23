import type { Block, Inline } from '@recruit/data/model';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { TableScroll } from '../layout/TableScroll';

export function InlineText({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((x, i) => {
        switch (x.t) {
          case 'text':
            return <Fragment key={i}>{x.v}</Fragment>;
          case 'b':
            return <strong key={i}><InlineText c={x.c} /></strong>;
          case 'i':
            return <em key={i}><InlineText c={x.c} /></em>;
          case 'a':
            // In-page anchors stay plain links; app paths go through the router.
            return x.href.startsWith('#') ? (
              <a key={i} href={x.href}><InlineText c={x.c} /></a>
            ) : (
              <Link key={i} to={x.href}><InlineText c={x.c} /></Link>
            );
        }
      })}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p':
      return <p><InlineText c={b.c} /></p>;
    case 'h3':
      return <h3 id={b.id}><InlineText c={b.c} /></h3>;
    case 'ul':
    case 'ol': {
      const items = b.items.map((item, i) => <li key={i}><Blocks blocks={item} /></li>);
      return b.t === 'ul' ? <ul className="blocks__list">{items}</ul> : <ol className="blocks__list">{items}</ol>;
    }
    case 'table':
      return (
        <TableScroll label="Table" style={{ marginBottom: '1rem' }}>
          <table className="stats blocks__table">
            <thead>
              <tr>{b.head.map((c, i) => <th key={i} scope="col"><InlineText c={c} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>{row.map((c, i) => <td key={i}><InlineText c={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      );
    case 'note':
      return (
        <div className={`note note--${b.kind}`}>
          <strong>{b.kind === 'tip' ? 'Tip' : 'Not confirmed'}:</strong> <InlineText c={b.c} />
        </div>
      );
  }
}

/** Compiled content blocks (Rules Reference articles, glossary terms, faction guides), rendered without HTML strings. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </>
  );
}
