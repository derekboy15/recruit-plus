import { Link } from 'react-router-dom';
import { PageHeader } from '../ui/PageHeader';

/** Any URL the app doesn't know: say so, and offer a way on, rather than silently going home. */
export function NotFound() {
  return (
    <>
      <PageHeader variant="top" title="Page not found" />
      <p>That page doesn’t exist. It may have moved, or the link is wrong.</p>
      <p className="not-found__links">
        <Link to="/" className="btn btn--primary">
          Go home
        </Link>
        <Link to="/build" className="btn">
          Your lists
        </Link>
      </p>
    </>
  );
}
