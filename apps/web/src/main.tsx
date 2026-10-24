import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { registerAfterLoad } from './pwa';
// Self-hosted faces (precached by the service worker, so they work offline); the theme comes after them.
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './fonts.css';
import './theme.css';

registerAfterLoad(() => registerSW({ immediate: true }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
