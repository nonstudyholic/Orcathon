# Orcathon Starter

Next.js + Supabase foundation built before the hackathon.

## Disclosure (pre-existing work)

This repository contained the following **before** hackathon began:

- Next.js 15 (App Router) + TypeScript + Tailwind CSS project setup
- Navbar with auth-aware Log in / Log out and a light/dark theme toggle
- Supabase email/password auth (sign up, log in, log out, email confirmation callback)
- Route protection for `/dashboard` via middleware
- `items` table with Row Level Security, plus full CRUD UI (create form, card grid, edit modal, delete, search and status filter)
- Vercel deployment configuration

### Built during the hackathon


### Tools and technologies

Next.js, React, TypeScript, Tailwind CSS, Supabase (Postgres, Auth), Vercel, Claude (AI assistance for the pre-built foundation),etc.

---

## Setup (about 10 minutes)

1. **Install:** `npm install`
2. **Supabase project:** create one at supabase.com.
3. **Database:** open SQL Editor, paste `supabase/schema.sql`, click Run.
4. **Auth settings** (Authentication -> Providers -> Email): turn **off** "Confirm email" for faster demos, or keep it on and set the URLs in step 6.
5. **Env vars:** copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings -> API).
6. **Run:** `npm run dev`, then open http://localhost:3000
7. **Deploy:** push to GitHub, import the repo in Vercel, add the same two env vars, deploy. Then in Supabase -> Authentication -> URL Configuration, set Site URL to your Vercel URL and add `https://YOUR-APP.vercel.app/auth/callback` to Redirect URLs.

Tag the baseline before the event starts:

```
git tag pre-hackathon-base && git push --tags
```

## Project structure

```
supabase/schema.sql          Table + RLS policies
src/middleware.ts            Session refresh + /dashboard protection
src/lib/supabase/*           Browser, server, and middleware clients
src/app/login                Sign up / log in
src/app/auth/*               Email callback and sign-out routes
src/app/dashboard            Protected page + server actions (create, update, delete)
src/components               Navbar, ThemeToggle, AuthForm, ItemsBoard, ItemForm
src/config.ts                App name and tagline
src/types.ts                 Item type, status list, category suggestions
docs/AI_INTEGRATION.md       Step-by-step LLM hookup for the event
```

## Adapting it to your idea

- **Rename things:** `src/config.ts` for the name; `src/types.ts` for statuses and categories.
- **Extra fields without migrations:** store them in `metadata` (jsonb). The form already has a JSON field for this.
- **New tables:** copy the RLS block in `schema.sql` and swap the table name.
- **Theme:** change the CSS variables at the top of `src/app/globals.css`.
