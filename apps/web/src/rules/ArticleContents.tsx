import { useId, useState } from 'react';
import { IconExpand } from '../ui/icons';

/**
 * "On this page": the article's sections as anchor links, for long articles (three sections or more). On a phone it is
 * a toggle above the article; from 1024px rules.css shows the list beside the article and hides the toggle.
 */
export function ArticleContents({ sections }: { sections: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (sections.length < 3) return null;
  return (
    <nav aria-label="On this page" className="article-contents">
      <button type="button" className="btn article-contents__toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        On this page
        <IconExpand size={18} aria-hidden="true" />
      </button>
      <p className="article-contents__label label-caps" aria-hidden="true">
        On this page
      </p>
      <ol id={listId} className="article-contents__list" hidden={!open}>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} onClick={() => setOpen(false)}>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
