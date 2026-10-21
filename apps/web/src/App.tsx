import { BrowserRouter } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
