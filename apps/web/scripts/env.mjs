/**
 * Build-time env checks (scripts/check-env.mjs runs them before every build). A Vercel production build must have
 * the Supabase project and the privacy contact, must use https, and must never turn on the local dev sign-in. A
 * preview build may run without Supabase (sign-in unavailable): that is only a warning. Local and CI builds need nothing.
 * @param {Record<string, string | undefined>} env
 * @param {(warning: string) => void} [warn]
 * @returns {string[]} problems that must stop the build
 */
export function checkEnv(env, warn = () => {}) {
  const problems = [];
  const missing = (names) => names.filter((n) => !env[n]?.trim());
  if (env.VERCEL_ENV === 'production') {
    for (const n of missing(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_CONTACT_EMAIL'])) problems.push(`${n} is required for a production deploy (see DEPLOY.md).`);
    if (env.VITE_AUTH_MODE === 'dev') problems.push('VITE_AUTH_MODE=dev must not be set for a production deploy.');
    if (env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_URL.startsWith('https://')) problems.push('VITE_SUPABASE_URL must start with https:// in production.');
  } else if (env.VERCEL_ENV === 'preview') {
    for (const n of missing(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])) warn(`${n} is not set: this preview has no sign-in.`);
  }
  return problems;
}
