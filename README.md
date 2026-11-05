# Firstfruit Commitments 2027

React (Vite) + Supabase app. Public progress page, password-protected admin.

- **`/#/`  Progress** (public): every member's progress bar, given vs committed, with search and a per-Sunday history when you tap a name.
- **`/#/admin`  Admin**:
  - *Members & commitments*: add, edit or delete a member and their committed amount.
  - *Sunday entries*: pick any of the 52 Sundays of 2027 (Jan 3 to Dec 26) and type each member's amount for that Sunday, then **Save Sunday**.

## Setup

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. (Safe to run again.)
3. In **Project Settings > API**, copy the Project URL and the publishable key (`sb_publishable_...`), or the legacy `anon` key.
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). Restart `npm run dev` after editing `.env`.
5. `npm install` then `npm run dev` and open http://localhost:5173.

## Deploy

`npm run build` makes a static site in `dist/`. Host it on Netlify, Vercel, Cloudflare Pages or GitHub Pages
and set the same `VITE_` variables in the host's environment settings. Hash routing (`#/admin`) means no
server rewrite rules are needed.

## About security (please read)

Members only ever see the Progress site. The Admin site asks for an email and password (Supabase Auth), and the
database only accepts changes from that signed-in user. The public key inside the Progress site can read but not write.

- Create the admin in Supabase > **Authentication > Users > Add user** (tick "Auto Confirm User").
- Turn **off** "Allow new users to sign up" (Authentication > Sign In / Providers > Email) so nobody else can register.
- Re-run `supabase/schema.sql` in the SQL Editor to apply the read-only policies (safe to run again).
- Supabase keeps daily backups on paid plans; on the free plan, export the tables now and then
  (Table Editor > Export to CSV).
