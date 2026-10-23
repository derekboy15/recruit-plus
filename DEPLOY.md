# Deploying Recruit+

This takes Recruit+ from this repository to a public site. The site is hosted on Vercel, with accounts and sync on Supabase. Each step says what to do and how to check it worked. Everything runs on free tiers.

You need three accounts: **Supabase**, **GitHub** and **Vercel**. Creating them, pushing the code and deploying are your decisions. Nothing here happens on its own.

---

## 1. Supabase: database and sign-in

1. **Create the project.** At <https://supabase.com/dashboard>, choose **New project**.
   - Pick a name (for example `recruit-plus`), a strong database password (keep it in your password manager) and a region near your players.
   - Note the region: the privacy page tells players their data is stored with Supabase.
   - *Check:* the project dashboard opens.
2. **Create the tables.** Open **SQL Editor → New query**. Paste the whole of `apps/web/supabase/migrations/0001_documents.sql`, then **Run**. Then do the same with `0002_rules_reports.sql`, in that order.
   - *Check:* **Table Editor** shows `documents`.
   - *Check:* **Authentication → Policies** shows five policies on `documents`: four "owners …" and "anyone reads public documents".
   - *Check:* **Database → Views** lists `rules_reports`.
3. **Turn on email sign-in.** Open **Authentication → Sign In / Providers → Email**. Enable it and keep **magic link** (passwordless) on.
   - The free tier's built-in email sender is rate-limited. For real use, set up custom SMTP under **Authentication → Emails → SMTP Settings**.
4. **Turn on Google sign-in.**
   1. In Google Cloud Console (<https://console.cloud.google.com>), go to **APIs & Services**. Set up the **OAuth consent screen** as External, with your app name and support email.
   2. Then go to **Credentials → Create credentials → OAuth client ID**, type **Web application**.
   3. Under **Authorised redirect URIs**, add the callback Supabase shows on its Google provider page. It looks like `https://<project-ref>.supabase.co/auth/v1/callback`.
   4. Copy the **Client ID** and **Client secret** into **Supabase → Authentication → Sign In / Providers → Google** and enable it.
5. **Set the redirect URLs.** Open **Authentication → URL Configuration** and set:
   - **Site URL:** your production address, e.g. `https://recruit-plus.vercel.app` (update it after step 4 if you add a domain).
   - **Redirect URLs:**
     - `https://<your-domain>/**`
     - `https://*-<your-vercel-team>.vercel.app/**` (preview deploys)
     - `http://localhost:5173/**` (local development)
6. **Copy the keys.** In **Project Settings → API**, copy the **Project URL** and the **anon public** key. The anon key is meant to be public; Row-Level Security protects the data. Never use the `service_role` key in the app.

## 2. GitHub: the repository

1. **Create a new repository** at <https://github.com/new>, private or public. Don't add a README; this repository has one.
2. **Push.** This needs your explicit go-ahead. From `L:\9th Edition\app` on `main`, run:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   *Check:* the **Actions** tab shows the **CI** workflow, and it goes green:
   - data build, typecheck and unit tests;
   - the production build and its size budgets;
   - both end-to-end suites.

## 3. Vercel: hosting

1. At <https://vercel.com/new>, **import** the GitHub repository. Leave the framework preset as **Other**. `vercel.json` sets the install command, build command (data fetch, data build, app build) and output folder (`apps/web/dist`).
2. **Before the first deploy**, open **Settings → Environment Variables** and add the variables in step 6's table:
   - **Production:** all three required ones.
   - **Preview:** at least the Supabase pair, or sign-in won't work on previews.

   A production build stops with a clear error if one is missing (`apps/web/scripts/check-env.mjs`).
3. **Deploy.** *Check:* the build log ends with the `PWA` precache summary, and the site opens.
4. **Optional: a custom domain.** Add it under **Settings → Domains**. Then update Supabase's **Site URL** and **Redirect URLs** (step 1.5) to it.

## 4. Check the live site

Do these on a phone where you can. Check each one:

1. **Signed out:** the home page, `/legal`, `/privacy` and `/terms` load. The footer disclaimer is on every page. The privacy page shows your contact email.
2. **Sign-in:** sign in with an email magic link, then sign out and sign in with Google.
3. **Sync:** build a list on the phone, then sign in on a second device. The list appears within a minute.
4. **Sharing:** share a list (Export → Share) and open the link in a private window, signed out. It opens read-only.
5. **Reports:** send one "Report a rules error". *Check:* it appears in Supabase under **Table Editor → rules_reports**, or by running `select * from rules_reports` in the SQL editor.
6. **Install:** use **Add to Home Screen**. It opens full-screen with the Recruit+ icon.
7. **Offline:**
   1. Open the app once while online, then turn on airplane mode.
   2. Open your lists, the rules, a lesson and a table game. They all work.
   3. Edit a list, then turn airplane mode off. The edit reaches the second device.
8. **Lighthouse:** in desktop Chrome DevTools, run Lighthouse (mobile, PWA, Accessibility). There should be no installability errors.

## 5. Rollback

If a deploy breaks something, go to Vercel **Deployments**, pick the last good one and choose **Promote to Production**. It takes effect at once. The database is untouched, because deploys never change it. Migrations are run by hand (step 1.2).

## 6. Environment variables

| Name | Used by | Required in production | Example |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Sign-in and sync (`apps/web/src/auth/backend.ts`). Must be `https://`. | Yes | `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sign-in and sync, with the URL. Public by design (RLS protects the data). | Yes | `eyJhbGciOi…` |
| `VITE_CONTACT_EMAIL` | The privacy page's contact for account and data deletion requests. | Yes | `recruitplus@example.org` |
| `VITE_AUTH_MODE` | Local development only: `dev` gives the "Continue (dev)" sign-in without Supabase. Production builds ignore it, and the env check refuses it for a production deploy. | No, and must not be `dev` | `dev` |

Local development reads `apps/web/.env.local`, starting from `apps/web/.env.example`. The production-build e2e tests read `apps/web/.env.e2e`. It points at a fake Supabase host that the tests answer, so it holds no secrets.

## 7. Later changes to the database

A new migration file in `apps/web/supabase/migrations/` is run by hand in the SQL editor, in number order, before deploying the code that needs it. Deploys never change the database.
