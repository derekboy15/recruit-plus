/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_MODE?: string;
  /** Where privacy requests go (shown on /privacy); required for a production deploy. */
  readonly VITE_CONTACT_EMAIL?: string;
  /** Where the Supabase database is hosted, as the privacy page states it (e.g. "the EU (Frankfurt)"); required for a production deploy. */
  readonly VITE_DATA_REGION?: string;
}
