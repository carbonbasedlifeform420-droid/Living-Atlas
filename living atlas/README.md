# Living Atlas 2.0 — Foundation alpha

A React + TypeScript + Vite starter for a multi-user Living Atlas beta, with four visual worlds, private Supabase cloud documents, import/export, and a migration foundation for 1.x backups.

## Quick start

1. Install Node.js 20.19+ or 22.12+.
2. `npm install`
3. `npm run dev` — works **without Supabase** in local preview mode (data is saved in this browser).
4. Open the displayed local URL. Select **Settings → Import backup** to load a 1.4–1.7 JSON export.
5. `npm run build` before deploying.

## Enable real accounts and cloud persistence

1. Create a Supabase project at https://supabase.com/dashboard.
2. In its **SQL Editor**, run `supabase/001_atlases.sql`.
3. Copy `.env.example` to `.env.local`. Enter your Supabase **Project URL** and **publishable key** (not a service-role or secret key). These `VITE_` values are public browser configuration; security depends on RLS.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to your local development URL (typically `http://localhost:5173`) and add the same to Redirect URLs. Later add your exact Vercel domain to Redirect URLs and update Site URL appropriately.
5. Run `npm run dev`, enter your email, and follow the magic link. You may need to enable email sign-in and configure email delivery/rate limits for a beta.
6. Import your backup under Settings and select **Save** to write to your private Supabase row. **Cloud saves are manual in this foundation alpha**; an unsaved changes indicator is shown.

## GitHub and Vercel

1. Create an empty **private** GitHub repository, e.g. `living-atlas`.
2. In the project folder: `git init && git add . && git commit -m "Living Atlas 2.0 foundation" && git branch -M main`.
3. Follow the commands GitHub provides to add your repository remote and push `main`.
4. At https://vercel.com/new import your GitHub repository. Framework: **Vite**; build command: `npm run build`; output directory: `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to Vercel **Project → Settings → Environment Variables**. Redeploy after adding them.
6. Add your actual Vercel URL to Supabase Auth redirect URLs and configure the Site URL.
7. Test sign-in, import, save, sign-out, sign-in again, and confirm the same atlas returns.

## Security and scope

- The SQL migration enables RLS and owner-only policies. **Never** put a Supabase secret or service-role key in Vite environment variables.
- The initial database stores one JSON document per user. This is an intentional migration-friendly foundation, **not** the final normalized collaboration and archive schema.
- The app preserves the original imported JSON inside `originalImport` for migration fidelity. Exported backups therefore may include the entire original document.
- **Not implemented yet:** shared live project permissions, bulk photo ingestion/original storage, AI recommendations, verified links, full Practice Paths editor, rich feedback, automatic cloud saves, multi-device merge/conflict resolution, offline synchronization, full localization, and beta-ready onboarding.
- Theme labels and font choices work, but themes are not yet the fully illustrated evolving worlds envisioned for beta.
- Before inviting external testers: review RLS with separate test accounts, build account deletion, autosave with conflict handling, privacy disclosures, operational backups, and error monitoring.

## First acceptance test

- [ ] Local preview loads without Supabase.
- [ ] All four themes switch without changing atlas data.
- [ ] 1.x backup imports goals, interests, experiences, and projects.
- [ ] Export creates a readable JSON file.
- [ ] Supabase sign-in works after setup.
- [ ] Saving then reloading from a different browser session restores data.
- [ ] A second test account cannot read the first account's atlas.
