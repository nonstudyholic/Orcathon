# Orcathon
# Built before hackathon :
web application, a pre-built foundation for hackathon
- Next.js 15 (App router) + TypeScript + Tailwind CSS
- navbar with auth-aware login/logout and light/dark theme toggle
- supabase email/pass auth
- route protection for `/dashboard` via middleware
- `items` table with Row Level Security, plus full CRUD UI (create form, card grid, edit modal, delete, search and status filter)
- Vercel deployment configuration

# Tools and technologies used : 
Next.js, React, TypeScript, Tailwind CSS, Supabase, Vercel, Claude (ai assistance for pre built project)  

 # Built during hackathon:

 # Setup
 1. **Install:** `npm install`
2. **Supabase project:** create one at supabase.com.
3. **Database:** open SQL Editor, paste `supabase/schema.sql`, click Run.
4. **Auth settings** (Authentication -> Providers -> Email): turn **off** "Confirm email" for faster demos, or keep it on and set the URLs in step 6.
5. **Env vars:** copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings -> API).
6. **Run:** `npm run dev`, then open http://localhost:3000
7. **Deploy:** push to GitHub, import the repo in Vercel, add the same two env vars, deploy. Then in Supabase -> Authentication -> URL Configuration, set Site URL to your Vercel URL and add `https://YOUR-APP.vercel.app/auth/callback` to Redirect URLs.

