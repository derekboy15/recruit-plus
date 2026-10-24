import { useMatch } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconAccount } from '../ui/icons';
import { Menu } from '../ui/Menu';

/** The account icon in the top bar: a menu headed by the signed-in email, with Sign out. */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  // A shared list is a read-only page for anyone: it has no account menu.
  const onSharePage = useMatch('/share/:id') !== null;
  if (!user || onSharePage) return null;
  return (
    <Menu
      label="Account"
      trigger={<IconAccount size={24} aria-hidden="true" />}
      header={user.email ?? 'Signed in'}
      items={[{ label: 'Sign out', onSelect: () => void signOut() }]}
    />
  );
}
